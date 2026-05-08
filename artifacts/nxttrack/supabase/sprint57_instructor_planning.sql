-- ═════════════════════════════════════════════════════════════════
-- Sprint 57 — Instructor Planning MVP
--
-- Voegt een planningslaag toe bovenop de bestaande trainer-structuur:
--   1. instructor_availability     — recurring weekly beschikbaarheid
--   2. instructor_unavailability   — datum-specifieke uitzonderingen
--                                    (vakantie/ziekte/training/anders)
--                                    + btree_gist exclusion-constraint
--                                    tegen overlap per member
--   3. session_instructors         — expliciete toewijzing per sessie
--                                    (primary/assistant/substitute/observer)
--                                    + replaces_member_id voor substitute
--   4. groups.default_min_instructors / training_sessions.min_instructors
--      — signalering van te weinig instructeurs op een sessie
--   5. view session_instructors_effective (security_invoker=true)
--      — single source-of-truth voor "wie is instructeur van deze sessie"
--      — fallback: leeg ⇒ alle group-members met trainer-rol; niet-leeg
--        ⇒ alleen de expliciete rijen winnen (geen Houtrust-regressie)
--   6. RPC detect_instructor_conflicts(tenant_id, from_date, to_date)
--      — vindt overlap, unavailability-blokken en weekly-not-available
--   7. notification dedup-index/RPC uitgebreid met
--      instructor_assignment_added/removed + substitute_assigned
--      (Sprint 41/43-patroon: index drop+recreate, predicate match)
--
-- Geen renames van bestaande `trainer_*` tabellen/kolommen.
-- Volledig idempotent — veilig om meermaals te draaien.
-- ═════════════════════════════════════════════════════════════════

create extension if not exists btree_gist;

-- ─────────────────────────────────────────────────────────────────
-- 1. instructor_availability — recurring weekly beschikbaarheid.
--    day_of_week: 0=maandag, 1=dinsdag, …, 6=zondag (ISO-stijl, los
--    van Postgres' date_part('isodow') = 1..7 — we mappen in app).
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.instructor_availability (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  member_id           uuid not null references public.members(id) on delete cascade,
  day_of_week         int  not null check (day_of_week between 0 and 6),
  start_time          time not null,
  end_time            time not null check (end_time > start_time),
  availability_type   text not null default 'available'
                      check (availability_type in ('available','preferred','unavailable')),
  valid_from          date,
  valid_until         date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists instructor_availability_tenant_member_idx
  on public.instructor_availability (tenant_id, member_id, day_of_week);

alter table public.instructor_availability enable row level security;

drop policy if exists "instructor_availability_tenant_all" on public.instructor_availability;
create policy "instructor_availability_tenant_all" on public.instructor_availability
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Self-read: een member-met-trainer-rol mag z'n eigen beschikbaarheid lezen.
drop policy if exists "instructor_availability_member_read" on public.instructor_availability;
create policy "instructor_availability_member_read" on public.instructor_availability
  for select using (
    exists (
      select 1 from public.members m
       where m.id = instructor_availability.member_id
         and m.tenant_id = instructor_availability.tenant_id
         and m.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 2. instructor_unavailability — datum-specifieke blokken.
--    btree_gist exclusion: zelfde member kan niet twee overlappende
--    unavailability-blokken hebben (Sprint 55-patroon).
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.instructor_unavailability (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null check (ends_at > starts_at),
  reason       text,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists instructor_unavailability_tenant_member_idx
  on public.instructor_unavailability (tenant_id, member_id, starts_at);

alter table public.instructor_unavailability
  drop constraint if exists instructor_unavailability_no_overlap;
alter table public.instructor_unavailability
  add constraint instructor_unavailability_no_overlap
  exclude using gist (
    member_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  );

alter table public.instructor_unavailability enable row level security;

drop policy if exists "instructor_unavailability_tenant_all" on public.instructor_unavailability;
create policy "instructor_unavailability_tenant_all" on public.instructor_unavailability
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

drop policy if exists "instructor_unavailability_member_read" on public.instructor_unavailability;
create policy "instructor_unavailability_member_read" on public.instructor_unavailability
  for select using (
    exists (
      select 1 from public.members m
       where m.id = instructor_unavailability.member_id
         and m.tenant_id = instructor_unavailability.tenant_id
         and m.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 3. session_instructors — expliciete toewijzing.
--    LEEG voor een sessie ⇒ effective-view valt terug op group-members
--    met trainer-rol (geen Houtrust-regressie).
--    NIET-LEEG ⇒ alleen deze rijen tellen.
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.session_instructors (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  session_id            uuid not null references public.training_sessions(id) on delete cascade,
  member_id             uuid not null references public.members(id) on delete cascade,
  assignment_type       text not null default 'primary'
                        check (assignment_type in ('primary','assistant','substitute','observer')),
  replaces_member_id    uuid references public.members(id) on delete set null,
  assigned_by           uuid references auth.users(id) on delete set null,
  assigned_at           timestamptz not null default now(),
  unique (session_id, member_id)
);

create index if not exists session_instructors_tenant_member_idx
  on public.session_instructors (tenant_id, member_id);
create index if not exists session_instructors_session_idx
  on public.session_instructors (session_id);

-- Een replaces_member_id mag alleen ingevuld zijn bij assignment_type='substitute'.
alter table public.session_instructors
  drop constraint if exists session_instructors_replaces_only_substitute;
alter table public.session_instructors
  add constraint session_instructors_replaces_only_substitute
  check (replaces_member_id is null or assignment_type = 'substitute');

alter table public.session_instructors enable row level security;

drop policy if exists "session_instructors_tenant_all" on public.session_instructors;
create policy "session_instructors_tenant_all" on public.session_instructors
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

drop policy if exists "session_instructors_member_read" on public.session_instructors;
create policy "session_instructors_member_read" on public.session_instructors
  for select using (
    exists (
      select 1 from public.members m
       where m.id = session_instructors.member_id
         and m.tenant_id = session_instructors.tenant_id
         and m.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 4. min-instructors signalering — kolommen.
-- ─────────────────────────────────────────────────────────────────
alter table public.groups
  add column if not exists default_min_instructors int;
alter table public.groups
  drop constraint if exists groups_default_min_instructors_chk;
alter table public.groups
  add constraint groups_default_min_instructors_chk
  check (default_min_instructors is null or default_min_instructors >= 0);

alter table public.training_sessions
  add column if not exists min_instructors int;
alter table public.training_sessions
  drop constraint if exists training_sessions_min_instructors_chk;
alter table public.training_sessions
  add constraint training_sessions_min_instructors_chk
  check (min_instructors is null or min_instructors >= 0);

-- ─────────────────────────────────────────────────────────────────
-- 5. view session_instructors_effective — single source-of-truth.
--    Fallback-modus: een sessie zonder enige `session_instructors`-rij
--    ziet alle group_members met trainer-rol (member_roles.role='trainer'
--    of een tenant_role met is_trainer_role=true). Eén expliciete rij
--    schakelt de fallback uit voor díe sessie.
--    is_explicit=true ⇒ rij komt uit session_instructors.
--    is_substitute_for_member_id is alleen gevuld bij substitute.
-- ─────────────────────────────────────────────────────────────────
create or replace view public.session_instructors_effective
  with (security_invoker = true) as
select
  s.id                                  as session_id,
  s.tenant_id                           as tenant_id,
  m.id                                  as member_id,
  coalesce(si.assignment_type, 'primary') as assignment_type,
  (si.id is not null)                   as is_explicit,
  si.replaces_member_id                 as is_substitute_for_member_id
from public.training_sessions s
join public.group_members gm on gm.group_id = s.group_id
join public.members        m  on m.id = gm.member_id and m.tenant_id = s.tenant_id
left join public.session_instructors si
       on si.session_id = s.id
      and si.member_id  = m.id
where (
  -- Expliciete rij wint altijd.
  si.id is not null
  or (
    -- Impliciete fallback: alleen als sessie geen expliciete rijen heeft.
    not exists (
      select 1 from public.session_instructors si2
       where si2.session_id = s.id
    )
    and (
      exists (
        select 1 from public.member_roles mr
         where mr.member_id = m.id and mr.role = 'trainer'
      )
      or exists (
        select 1 from public.tenant_member_roles tmr
        join public.tenant_roles tr on tr.id = tmr.role_id
         where tmr.member_id = m.id
           and tmr.tenant_id = s.tenant_id
           and tr.is_trainer_role = true
      )
    )
  )
)
union all
-- Substitutes die NIET in de groep zitten (out-of-group vervangers).
select
  s.id                                  as session_id,
  s.tenant_id                           as tenant_id,
  si.member_id                          as member_id,
  si.assignment_type                    as assignment_type,
  true                                  as is_explicit,
  si.replaces_member_id                 as is_substitute_for_member_id
from public.training_sessions s
join public.session_instructors si on si.session_id = s.id
where not exists (
  select 1 from public.group_members gm
   where gm.group_id = s.group_id and gm.member_id = si.member_id
);

grant select on public.session_instructors_effective to authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 6. RPC detect_instructor_conflicts — vier conflict-soorten:
--      'overlap'              — zelfde member op twee overlappende sessies
--      'unavailable_block'    — sessie binnen instructor_unavailability
--      'not_available_weekly' — sessie op dag/tijd waar member
--                               availability_type='unavailable' heeft
--      'understaffed'         — sessie met minder primary-instructeurs
--                               dan effective min_instructors
--    Returnt een rijenlijst — UI bepaalt zelf hoe te tonen.
-- ─────────────────────────────────────────────────────────────────
drop function if exists public.detect_instructor_conflicts(uuid, timestamptz, timestamptz);

create or replace function public.detect_instructor_conflicts(
  p_tenant_id   uuid,
  p_from        timestamptz,
  p_to          timestamptz
) returns table (
  conflict_kind     text,
  session_id        uuid,
  session_starts_at timestamptz,
  session_ends_at   timestamptz,
  member_id         uuid,
  detail            text
)
language sql
stable
security invoker
set search_path = public
as $$
  -- 1. Overlap tussen twee sessies voor dezelfde member.
  select
    'overlap'::text                       as conflict_kind,
    s1.id                                 as session_id,
    s1.starts_at                          as session_starts_at,
    s1.ends_at                            as session_ends_at,
    e1.member_id                          as member_id,
    'overlapt met sessie ' || s2.id::text as detail
  from public.training_sessions s1
  join public.session_instructors_effective e1 on e1.session_id = s1.id
  join public.session_instructors_effective e2 on e2.member_id = e1.member_id and e2.session_id <> e1.session_id
  join public.training_sessions s2 on s2.id = e2.session_id
  where s1.tenant_id = p_tenant_id
    and s1.starts_at >= p_from and s1.starts_at < p_to
    and s2.tenant_id = p_tenant_id
    and tstzrange(s1.starts_at, s1.ends_at, '[)') && tstzrange(s2.starts_at, s2.ends_at, '[)')
    and s1.id < s2.id  -- elk paar slechts één keer

  union all

  -- 2. Sessie binnen een unavailability-blok.
  select
    'unavailable_block'::text as conflict_kind,
    s.id                     as session_id,
    s.starts_at              as session_starts_at,
    s.ends_at                as session_ends_at,
    e.member_id              as member_id,
    coalesce(u.reason, 'unavailable') as detail
  from public.training_sessions s
  join public.session_instructors_effective e on e.session_id = s.id
  join public.instructor_unavailability u
        on u.tenant_id = s.tenant_id
       and u.member_id = e.member_id
       and tstzrange(u.starts_at, u.ends_at, '[)') && tstzrange(s.starts_at, s.ends_at, '[)')
  where s.tenant_id = p_tenant_id
    and s.starts_at >= p_from and s.starts_at < p_to

  union all

  -- 3. Sessie op dag/tijd waar member availability_type='unavailable' heeft.
  --    Postgres date_part('isodow') = 1..7 (1=ma..7=zo) → mappen naar 0..6.
  select
    'not_available_weekly'::text  as conflict_kind,
    s.id                         as session_id,
    s.starts_at                  as session_starts_at,
    s.ends_at                    as session_ends_at,
    e.member_id                  as member_id,
    'weekly availability_type=unavailable' as detail
  from public.training_sessions s
  join public.session_instructors_effective e on e.session_id = s.id
  join public.instructor_availability ia
        on ia.tenant_id   = s.tenant_id
       and ia.member_id   = e.member_id
       and ia.day_of_week = ((extract(isodow from s.starts_at)::int) - 1)
       and ia.availability_type = 'unavailable'
       and (ia.valid_from  is null or ia.valid_from  <= s.starts_at::date)
       and (ia.valid_until is null or ia.valid_until >= s.starts_at::date)
       and ia.start_time <= (s.starts_at::time)
       and ia.end_time   >= (s.ends_at::time)
  where s.tenant_id = p_tenant_id
    and s.starts_at >= p_from and s.starts_at < p_to

  union all

  -- 4. Understaffed: # primary-toewijzingen < effective min_instructors.
  select
    'understaffed'::text         as conflict_kind,
    s.id                         as session_id,
    s.starts_at                  as session_starts_at,
    s.ends_at                    as session_ends_at,
    null::uuid                   as member_id,
    ('need=' || coalesce(s.min_instructors, g.default_min_instructors, 1)::text
       || ' have=' || coalesce(prim.cnt, 0)::text) as detail
  from public.training_sessions s
  join public.groups g on g.id = s.group_id
  left join (
    select session_id, count(*)::int as cnt
      from public.session_instructors_effective
     where assignment_type = 'primary'
     group by session_id
  ) prim on prim.session_id = s.id
  where s.tenant_id = p_tenant_id
    and s.starts_at >= p_from and s.starts_at < p_to
    and coalesce(prim.cnt, 0) < coalesce(s.min_instructors, g.default_min_instructors, 1);
$$;

grant execute on function public.detect_instructor_conflicts(uuid, timestamptz, timestamptz) to authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 7. notification dedup-index/RPC — Sprint 41/43-patroon, drop + recreate.
--    Oude lijst (Sprint 55) komt terug + 3 nieuwe instructor-keys.
-- ─────────────────────────────────────────────────────────────────
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
          'certificate_issued',
          'progress_milestone_reached',
          'instructor_assignment_added',
          'instructor_assignment_removed',
          'substitute_assigned'
        )
    and source_ref is not null;

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
      'milestone_event_invited','milestone_event_result_published','certificate_issued',
      'progress_milestone_reached',
      'instructor_assignment_added','instructor_assignment_removed','substitute_assigned'
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
            'milestone_event_invited','milestone_event_result_published','certificate_issued',
            'progress_milestone_reached',
            'instructor_assignment_added','instructor_assignment_removed','substitute_assigned'
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
    raise exception 'create_notification_with_recipients: insert returned no id';
  end if;

  for recipient in select * from jsonb_array_elements(coalesce(p_recipients, '[]'::jsonb)) loop
    insert into public.notification_recipients (notification_id, user_id)
    values (notif_id, (recipient->>'user_id')::uuid)
    on conflict (notification_id, user_id) do nothing;
  end loop;

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

-- Einde sprint57.
