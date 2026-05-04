-- ──────────────────────────────────────────────────────────
-- Sprint 11 — Notifications.
--
--   notifications              (one row per sent notification)
--   notification_targets       (audience definition: member|group|role|all)
--   notification_recipients    (resolved per-user delivery rows)
--   notification_events        (per-tenant trigger config)
--
-- Tenant-scoped. RLS via has_tenant_access(). End-users can read only
-- their own notification_recipients rows (and the linked notification).
--
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

-- ── notifications ────────────────────────────────────────
create table if not exists public.notifications (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  title         text        not null,
  content_html  text,
  content_text  text,
  source        text,                                   -- e.g. 'manual', 'news_published'
  source_ref    uuid,                                   -- e.g. news_post id
  email_sent    boolean     not null default false,
  created_by    uuid        references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_tenant_created_idx
  on public.notifications (tenant_id, created_at desc);

-- ── notification_targets ─────────────────────────────────
create table if not exists public.notification_targets (
  id              uuid      primary key default gen_random_uuid(),
  notification_id uuid      not null references public.notifications(id) on delete cascade,
  target_type     text      not null check (target_type in ('member','group','role','all')),
  -- text (not uuid) so role targets can store role names directly.
  target_id       text,                                 -- null when target_type = 'all'
  created_at      timestamptz not null default now()
);

-- Migrate target_id from uuid → text if a previous run used the old type.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='notification_targets'
      and column_name='target_id' and data_type='uuid'
  ) then
    alter table public.notification_targets alter column target_id type text using target_id::text;
  end if;
end $$;

create index if not exists notification_targets_notif_idx
  on public.notification_targets (notification_id);

-- ── notification_recipients ──────────────────────────────
create table if not exists public.notification_recipients (
  id              uuid      primary key default gen_random_uuid(),
  notification_id uuid      not null references public.notifications(id) on delete cascade,
  tenant_id       uuid      not null references public.tenants(id) on delete cascade,
  member_id       uuid      references public.members(id) on delete cascade,
  user_id         uuid      not null references auth.users(id) on delete cascade,
  is_read         boolean   not null default false,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (notification_id, user_id)
);

create index if not exists notif_recipients_user_unread_idx
  on public.notification_recipients (user_id, is_read, created_at desc);

create index if not exists notif_recipients_tenant_idx
  on public.notification_recipients (tenant_id);

-- Defense in depth: enforce that a recipient row's tenant_id matches its
-- parent notification's tenant_id, AND that the immutable foreign keys
-- (notification_id / tenant_id / member_id / user_id) cannot be rewritten
-- on UPDATE. This closes the cross-tenant-leakage vector where a recipient
-- could repoint their row at a foreign notification (which would otherwise
-- gain them read access via `notifications_recipient_read`).
create or replace function public.notification_recipients_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  parent_tenant uuid;
begin
  if (tg_op = 'INSERT') then
    select n.tenant_id into parent_tenant
      from public.notifications n where n.id = new.notification_id;
    if parent_tenant is null then
      raise exception 'notification_recipients: parent notification % not found', new.notification_id;
    end if;
    if new.tenant_id is distinct from parent_tenant then
      raise exception 'notification_recipients: tenant_id mismatch with parent notification';
    end if;
    return new;
  elsif (tg_op = 'UPDATE') then
    if new.notification_id is distinct from old.notification_id
       or new.tenant_id    is distinct from old.tenant_id
       or new.member_id    is distinct from old.member_id
       or new.user_id      is distinct from old.user_id then
      raise exception 'notification_recipients: notification_id/tenant_id/member_id/user_id are immutable';
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists notification_recipients_integrity_trg on public.notification_recipients;
create trigger notification_recipients_integrity_trg
  before insert or update on public.notification_recipients
  for each row execute function public.notification_recipients_integrity();

-- ── notification_events (trigger config) ─────────────────
create table if not exists public.notification_events (
  id                uuid       primary key default gen_random_uuid(),
  tenant_id         uuid       not null references public.tenants(id) on delete cascade,
  event_key         text       not null,
  template_enabled  boolean    not null default true,
  email_enabled     boolean    not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, event_key)
);

create index if not exists notif_events_tenant_idx
  on public.notification_events (tenant_id);

-- updated_at trigger reuses existing handle_updated_at()
drop trigger if exists notification_events_updated_at on public.notification_events;
create trigger notification_events_updated_at
  before update on public.notification_events
  for each row execute function public.handle_updated_at();

-- ═════════════════════════════════════════════════════════
--  RLS
-- ═════════════════════════════════════════════════════════

alter table public.notifications            enable row level security;
alter table public.notification_targets     enable row level security;
alter table public.notification_recipients  enable row level security;
alter table public.notification_events      enable row level security;

-- ── notifications ────────────────────────────────────────
drop policy if exists "notifications_tenant_all"      on public.notifications;
drop policy if exists "notifications_recipient_read"  on public.notifications;

create policy "notifications_tenant_all" on public.notifications
  for all  using (public.has_tenant_access(tenant_id))
           with check (public.has_tenant_access(tenant_id));

-- End-users can read the notification rows they were delivered.
create policy "notifications_recipient_read" on public.notifications
  for select using (
    exists (
      select 1 from public.notification_recipients r
      where r.notification_id = notifications.id
        and r.user_id = auth.uid()
    )
  );

-- ── notification_targets ─────────────────────────────────
drop policy if exists "notification_targets_tenant_all" on public.notification_targets;

create policy "notification_targets_tenant_all" on public.notification_targets
  for all  using (
    exists (
      select 1 from public.notifications n
      where n.id = notification_targets.notification_id
        and public.has_tenant_access(n.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.notifications n
      where n.id = notification_targets.notification_id
        and public.has_tenant_access(n.tenant_id)
    )
  );

-- ── notification_recipients ──────────────────────────────
drop policy if exists "notif_recipients_tenant_all" on public.notification_recipients;
drop policy if exists "notif_recipients_self_read"  on public.notification_recipients;
drop policy if exists "notif_recipients_self_update" on public.notification_recipients;

create policy "notif_recipients_tenant_all" on public.notification_recipients
  for all  using (public.has_tenant_access(tenant_id))
           with check (public.has_tenant_access(tenant_id));

-- End-users can read their own delivery rows...
create policy "notif_recipients_self_read" on public.notification_recipients
  for select using (auth.uid() = user_id);

-- ...and flip is_read / read_at on those rows.
create policy "notif_recipients_self_update" on public.notification_recipients
  for update using (auth.uid() = user_id)
           with check (auth.uid() = user_id);

-- ── notification_events ──────────────────────────────────
drop policy if exists "notif_events_tenant_all" on public.notification_events;

create policy "notif_events_tenant_all" on public.notification_events
  for all  using (public.has_tenant_access(tenant_id))
           with check (public.has_tenant_access(tenant_id));
