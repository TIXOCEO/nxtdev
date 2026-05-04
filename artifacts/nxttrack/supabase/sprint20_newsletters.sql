-- ─────────────────────────────────────────────────────────
-- NXTTRACK — Sprint 20: Newsletter system
-- Run in: Supabase Dashboard → SQL Editor
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────

-- v1 scope: NO scheduling. Drafts can be saved and sent immediately.
-- Audience: 'all' active members of the tenant, OR a multi-select of groups.

create table if not exists public.newsletters (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         uuid        not null references public.tenants (id) on delete cascade,
  title             text        not null,
  preheader         text,
  -- TipTap editor output (HTML); inner body only — branded wrap is added at send time.
  content_html      text        not null default '',
  -- Optional plaintext fallback for mail clients without HTML.
  content_text      text,
  -- 'draft' (editable) | 'sending' (lock) | 'sent' (final) | 'failed'
  status            text        not null default 'draft'
                       check (status in ('draft','sending','sent','failed')),
  -- 'all' = every active member of the tenant; 'groups' = audience_group_ids
  audience_type     text        not null default 'all'
                       check (audience_type in ('all','groups')),
  audience_group_ids uuid[]     not null default '{}'::uuid[],
  -- Counters populated when sendNow finishes.
  recipient_count   integer     not null default 0,
  sent_count        integer     not null default 0,
  failed_count      integer     not null default 0,
  last_error        text,
  sent_at           timestamptz,
  created_by        uuid        references auth.users (id) on delete set null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_newsletters_tenant_status
  on public.newsletters(tenant_id, status, updated_at desc);

-- updated_at trigger (re-uses the shared touch function from schema.sql / sprint3).
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    execute 'drop trigger if exists newsletters_updated_at on public.newsletters';
    execute 'create trigger newsletters_updated_at before update on public.newsletters '
         || 'for each row execute function public.set_updated_at()';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────
-- RLS — tenant admins (and platform admins) only.
-- Re-uses public.fn_is_tenant_admin(uuid) introduced in sprint19_social_feed.sql.
-- ─────────────────────────────────────────────────────────
alter table public.newsletters enable row level security;

drop policy if exists nl_admin_select on public.newsletters;
create policy nl_admin_select on public.newsletters
  for select using (public.fn_is_tenant_admin(tenant_id));

drop policy if exists nl_admin_all on public.newsletters;
create policy nl_admin_all on public.newsletters
  for all using (public.fn_is_tenant_admin(tenant_id))
  with check (public.fn_is_tenant_admin(tenant_id));
