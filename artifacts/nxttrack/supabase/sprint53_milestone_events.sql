-- ──────────────────────────────────────────────────────────
-- Sprint 53 — Diploma-event planning + certificaten
--
--   * milestone_events (datum, optionele resource, capaciteit, examinator)
--   * milestone_event_invites (per lid + decision_token)
--   * certificates (uitgegeven diploma, optioneel pdf-pad)
--   * tenant_roles.is_examiner_role boolean (analoog aan is_trainer_role)
--   * Notificatie-dedup: index + RPC uitgebreid met de drie nieuwe sources
--     (`milestone_event_invited`, `milestone_event_result_published`,
--      `certificate_issued`) en de wachtlijst/inhaalles-keys uit C/D.
--
-- Volledig idempotent.
-- ──────────────────────────────────────────────────────────

-- ── Examinator-flag op tenant_roles ──────────────────────────────
alter table public.tenant_roles
  add column if not exists is_examiner_role boolean not null default false;

-- ── Events ────────────────────────────────────────────────────────
create table if not exists public.milestone_events (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants(id) on delete cascade,
  milestone_id    uuid        not null references public.milestones(id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  resource_id     uuid        references public.capacity_resources(id) on delete set null,
  capacity        int         check (capacity is null or capacity > 0),
  examiner_user_id uuid       references auth.users(id) on delete set null,
  status          text        not null default 'planned'
                  check (status in ('planned','open','closed','cancelled')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists milestone_events_tenant_idx
  on public.milestone_events (tenant_id, starts_at);

drop trigger if exists milestone_events_updated_at on public.milestone_events;
create trigger milestone_events_updated_at
  before update on public.milestone_events
  for each row execute function public.handle_updated_at();

alter table public.milestone_events enable row level security;

drop policy if exists "milestone_events_tenant_all"  on public.milestone_events;
drop policy if exists "milestone_events_member_read" on public.milestone_events;

create policy "milestone_events_tenant_all" on public.milestone_events
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

create policy "milestone_events_member_read" on public.milestone_events
  for select
  using (
    exists (
      select 1 from public.members m
       where m.tenant_id = milestone_events.tenant_id
         and m.user_id   = auth.uid()
    )
  );

-- ── Invites ───────────────────────────────────────────────────────
create table if not exists public.milestone_event_invites (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants(id) on delete cascade,
  event_id        uuid        not null references public.milestone_events(id) on delete cascade,
  member_id       uuid        not null references public.members(id) on delete cascade,
  decision_token  text        not null unique,
  status          text        not null default 'invited'
                  check (status in ('invited','accepted','declined','attended','passed','retry','no_show','cancelled')),
  decided_at      timestamptz,
  result_note     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (event_id, member_id)
);

create index if not exists milestone_event_invites_event_idx
  on public.milestone_event_invites (event_id, status);
create index if not exists milestone_event_invites_member_idx
  on public.milestone_event_invites (tenant_id, member_id, created_at desc);

drop trigger if exists milestone_event_invites_updated_at on public.milestone_event_invites;
create trigger milestone_event_invites_updated_at
  before update on public.milestone_event_invites
  for each row execute function public.handle_updated_at();

alter table public.milestone_event_invites enable row level security;

drop policy if exists "milestone_event_invites_tenant_all"  on public.milestone_event_invites;
drop policy if exists "milestone_event_invites_member_read" on public.milestone_event_invites;

create policy "milestone_event_invites_tenant_all" on public.milestone_event_invites
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

create policy "milestone_event_invites_member_read" on public.milestone_event_invites
  for select
  using (
    exists (
      select 1 from public.members m
       where m.id = milestone_event_invites.member_id
         and m.tenant_id = milestone_event_invites.tenant_id
         and m.user_id   = auth.uid()
    )
    or exists (
      select 1 from public.member_links ml
       join public.members p on p.id = ml.parent_member_id
       where ml.child_member_id = milestone_event_invites.member_id
         and p.tenant_id = milestone_event_invites.tenant_id
         and p.user_id = auth.uid()
    )
  );

-- ── Certificaten ─────────────────────────────────────────────────
create table if not exists public.certificates (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants(id) on delete cascade,
  member_id       uuid        not null references public.members(id) on delete cascade,
  milestone_id    uuid        not null references public.milestones(id) on delete restrict,
  event_invite_id uuid        references public.milestone_event_invites(id) on delete set null,
  awarded_at      timestamptz not null default now(),
  pdf_object_path text,
  created_at      timestamptz not null default now(),
  unique (member_id, milestone_id)
);

create index if not exists certificates_tenant_idx
  on public.certificates (tenant_id, awarded_at desc);
create index if not exists certificates_member_idx
  on public.certificates (tenant_id, member_id);

alter table public.certificates enable row level security;

drop policy if exists "certificates_tenant_all"  on public.certificates;
drop policy if exists "certificates_member_read" on public.certificates;

create policy "certificates_tenant_all" on public.certificates
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

create policy "certificates_member_read" on public.certificates
  for select
  using (
    exists (
      select 1 from public.members m
       where m.id = certificates.member_id
         and m.tenant_id = certificates.tenant_id
         and m.user_id   = auth.uid()
    )
    or exists (
      select 1 from public.member_links ml
       join public.members p on p.id = ml.parent_member_id
       where ml.child_member_id = certificates.member_id
         and p.tenant_id = certificates.tenant_id
         and p.user_id = auth.uid()
    )
  );

-- ═════════════════════════════════════════════════════════════════
-- Notificatie-dedup uitbreiden — Sprint 41/43-patroon
-- ═════════════════════════════════════════════════════════════════
-- Backfill duplicaten op de nieuwe source-keys (mocht er met de hand
-- al iets ingestoken zijn).
with ranked as (
  select id,
         row_number() over (
           partition by tenant_id, source, source_ref
           order by created_at, id
         ) as rn
    from public.notifications
   where source in (
           'training_created',
           'training_reminder',
           'group_assigned',
           'news_published',
           'membership_assigned',
           'invite_accepted',
           'attendance_changed_late',
           'trainer_attendance_updated',
           'waitlist_offer_sent',
           'waitlist_offer_accepted',
           'waitlist_offer_declined',
           'makeup_credit_granted',
           'makeup_request_approved',
           'makeup_request_declined',
           'milestone_event_invited',
           'milestone_event_result_published',
           'certificate_issued'
         )
     and source_ref is not null
)
update public.notifications n
   set source_ref = null
  from ranked r
 where n.id = r.id
   and r.rn > 1;

-- Index drop + recreate (predicate moet exact matchen met RPC on conflict).
drop index if exists public.notifications_source_idem_uq;

create unique index notifications_source_idem_uq
  on public.notifications (tenant_id, source, source_ref)
  where source in (
          'training_created',
          'training_reminder',
          'group_assigned',
          'news_published',
          'membership_assigned',
          'invite_accepted',
          'attendance_changed_late',
          'trainer_attendance_updated',
          'waitlist_offer_sent',
          'waitlist_offer_accepted',
          'waitlist_offer_declined',
          'makeup_credit_granted',
          'makeup_request_approved',
          'makeup_request_declined',
          'milestone_event_invited',
          'milestone_event_result_published',
          'certificate_issued'
        )
    and source_ref is not null;

-- RPC: predicate één-op-één synchroon met de nieuwe index.
create or replace function public.create_notification_with_recipients(
  p_tenant_id     uuid,
  p_title         text,
  p_content_html  text,
  p_content_text  text,
  p_source        text,
  p_source_ref    uuid,
  p_created_by    uuid,
  p_targets       jsonb,
  p_recipients    jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notif_id     uuid;
  is_dedupable boolean;
  recipient    jsonb;
begin
  is_dedupable :=
    p_source_ref is not null
    and coalesce(p_source, '') in (
      'training_created','training_reminder','group_assigned',
      'news_published','membership_assigned','invite_accepted',
      'attendance_changed_late','trainer_attendance_updated',
      'waitlist_offer_sent','waitlist_offer_accepted','waitlist_offer_declined',
      'makeup_credit_granted','makeup_request_approved','makeup_request_declined',
      'milestone_event_invited','milestone_event_result_published','certificate_issued'
    );

  if is_dedupable then
    select id into notif_id
      from public.notifications
     where tenant_id = p_tenant_id
       and source    = p_source
       and source_ref = p_source_ref
     limit 1;
    if notif_id is not null then
      return notif_id;
    end if;
  end if;

  insert into public.notifications
    (tenant_id, title, content_html, content_text, source, source_ref, created_by)
  values
    (p_tenant_id, p_title, p_content_html, p_content_text, p_source, p_source_ref, p_created_by)
  on conflict (tenant_id, source, source_ref)
    where source in (
            'training_created','training_reminder','group_assigned',
            'news_published','membership_assigned','invite_accepted',
            'attendance_changed_late','trainer_attendance_updated',
            'waitlist_offer_sent','waitlist_offer_accepted','waitlist_offer_declined',
            'makeup_credit_granted','makeup_request_approved','makeup_request_declined',
            'milestone_event_invited','milestone_event_result_published','certificate_issued'
          )
      and source_ref is not null
    do nothing
  returning id into notif_id;

  if notif_id is null and is_dedupable then
    select id into notif_id
      from public.notifications
     where tenant_id = p_tenant_id
       and source    = p_source
       and source_ref = p_source_ref
     limit 1;
  end if;

  if notif_id is null then
    -- Fallback: niet-dedupable insert die om welke reden dan ook geen id teruggaf.
    raise exception 'create_notification_with_recipients: insert returned no id';
  end if;

  -- Recipients (idempotent): één rij per user.
  for recipient in select * from jsonb_array_elements(coalesce(p_recipients, '[]'::jsonb)) loop
    insert into public.notification_recipients (notification_id, user_id)
    values (notif_id, (recipient->>'user_id')::uuid)
    on conflict (notification_id, user_id) do nothing;
  end loop;

  -- Targets (idempotent): één rij per target_kind+target_id paar.
  for recipient in select * from jsonb_array_elements(coalesce(p_targets, '[]'::jsonb)) loop
    insert into public.notification_targets (notification_id, target_kind, target_id)
    values (notif_id,
            recipient->>'target_kind',
            nullif(recipient->>'target_id','')::uuid)
    on conflict do nothing;
  end loop;

  return notif_id;
end;
$$;
