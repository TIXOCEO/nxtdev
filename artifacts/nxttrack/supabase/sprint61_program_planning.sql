-- ═════════════════════════════════════════════════════════════════
-- Sprint 61 — Programs MVP fase 2: instructeurs + resources defaults
--                + cascade-uitbreiding view/RPC + nullable program_id
--                op training_sessions.
--
-- Files in deze sprint (volgorde):
--   * sprint61_program_planning.sql   (deze)
--   * sprint61_release_v0_17_0.sql    (release-notes-row)
--
-- Houtrust-veiligheid:
--   - Alle nieuwe FK's zijn nullable; `training_sessions.program_id`
--     blijft NULL voor alle bestaande Houtrust-data.
--   - `session_instructors_effective` rewrite: de eerste twee branches
--     blijven byte-identiek aan Sprint 57. De derde program_default-
--     branch vuurt alleen wanneer `s.program_id IS NOT NULL` én
--     wanneer er geen expliciete sessie-instructeur én geen
--     group-trainer is — voor Houtrust dus per definitie 0 extra rijen.
--   - `detect_instructor_conflicts` rewrite: `coalesce(s.min_instructors,
--     g.default_min_instructors, p.default_min_instructors, 1)` met
--     `left join programs p`. Voor sessies zonder program_id geeft
--     `p.default_min_instructors` NULL → coalesce gedraagt zich
--     identiek aan Sprint 59.
--
-- Idempotent — drop+create / if not exists overal.
-- ═════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 0. Composite (id, tenant_id) unique op training_sessions.
--    Vereiste voor de composite FK vanuit toekomstige join-tabellen
--    (Sprint 62+). Zelfde patroon als Sprint 60.
-- ─────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'training_sessions_id_tenant_uq'
  ) then
    alter table public.training_sessions
      add constraint training_sessions_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────
-- 1. training_sessions.program_id — nullable FK naar programs.
--    Composite FK garandeert dat sessie + program in dezelfde tenant
--    leven (zie §3.5 van programs-foundation-research.md).
-- ─────────────────────────────────────────────────────────────────
alter table public.training_sessions
  add column if not exists program_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'training_sessions_program_tenant_fk'
  ) then
    alter table public.training_sessions
      add constraint training_sessions_program_tenant_fk
      foreign key (program_id, tenant_id)
      references public.programs (id, tenant_id)
      on delete set null;
  end if;
end $$;

create index if not exists training_sessions_program_idx
  on public.training_sessions (program_id)
  where program_id is not null;

-- ─────────────────────────────────────────────────────────────────
-- 2. program_instructors — default-toewijzing van instructeurs aan
--    een program, gebruikt door view-fallback wanneer noch expliciete
--    sessie-instructeurs noch group-trainers beschikbaar zijn.
--
--    assignment_type vocab matcht session_instructors:
--      'primary' | 'assistant'
--    (`substitute` en `observer` zijn alleen op sessie-niveau zinvol.)
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.program_instructors (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  program_id      uuid not null,
  member_id       uuid not null,
  assignment_type text not null default 'primary'
                  check (assignment_type in ('primary','assistant')),
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'program_instructors_program_tenant_fk') then
    alter table public.program_instructors
      add constraint program_instructors_program_tenant_fk
      foreign key (program_id, tenant_id)
      references public.programs (id, tenant_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'program_instructors_member_tenant_fk') then
    alter table public.program_instructors
      add constraint program_instructors_member_tenant_fk
      foreign key (member_id, tenant_id)
      references public.members (id, tenant_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'program_instructors_program_member_uq') then
    alter table public.program_instructors
      add constraint program_instructors_program_member_uq
      unique (program_id, member_id);
  end if;
end $$;

create index if not exists program_instructors_program_idx
  on public.program_instructors (program_id);
create index if not exists program_instructors_member_idx
  on public.program_instructors (member_id);

drop trigger if exists program_instructors_set_updated_at on public.program_instructors;
create trigger program_instructors_set_updated_at
  before update on public.program_instructors
  for each row execute function public.handle_updated_at();

alter table public.program_instructors enable row level security;

drop policy if exists "program_instructors_tenant_all" on public.program_instructors;
create policy "program_instructors_tenant_all" on public.program_instructors
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- ─────────────────────────────────────────────────────────────────
-- 3. program_resources — default-resource-bindings die bij sessie-
--    creatie naar session_resources worden gekopieerd. De kopie zelf
--    gebeurt in actions/tenant/trainings.ts (server-action), zodat de
--    bestaande btree_gist exclusion-constraint op session_resources
--    (Sprint 55) automatisch dubbel-boekingen detecteert.
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.program_resources (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  program_id       uuid not null,
  resource_id      uuid not null,
  max_participants int  check (max_participants is null or max_participants > 0),
  notes            text,
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'program_resources_program_tenant_fk') then
    alter table public.program_resources
      add constraint program_resources_program_tenant_fk
      foreign key (program_id, tenant_id)
      references public.programs (id, tenant_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'program_resources_resource_tenant_fk') then
    alter table public.program_resources
      add constraint program_resources_resource_tenant_fk
      foreign key (resource_id, tenant_id)
      references public.capacity_resources (id, tenant_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'program_resources_program_resource_uq') then
    alter table public.program_resources
      add constraint program_resources_program_resource_uq
      unique (program_id, resource_id);
  end if;
end $$;

create index if not exists program_resources_program_idx
  on public.program_resources (program_id);
create index if not exists program_resources_resource_idx
  on public.program_resources (resource_id);

drop trigger if exists program_resources_set_updated_at on public.program_resources;
create trigger program_resources_set_updated_at
  before update on public.program_resources
  for each row execute function public.handle_updated_at();

alter table public.program_resources enable row level security;

drop policy if exists "program_resources_tenant_all" on public.program_resources;
create policy "program_resources_tenant_all" on public.program_resources
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- ═════════════════════════════════════════════════════════════════
-- 4. View `session_instructors_effective` rewrite met derde
--    fallback-laag (program_default).
--
--    Branches 1 + 2 zijn semantisch identiek aan Sprint 57 — deze
--    rewrite voegt enkel een derde UNION ALL toe. Voor sessies zonder
--    program_id (alle Houtrust-sessies) is `s.program_id IS NULL` →
--    de derde branch produceert 0 rijen → byte-identiek gedrag.
-- ═════════════════════════════════════════════════════════════════
drop view if exists public.session_instructors_effective;
create view public.session_instructors_effective
with (security_invoker = true) as
  -- Branch 1: groepsleden + (impliciete trainer-fallback óf expliciete toewijzing).
  select
    s.id                                                  as session_id,
    s.tenant_id,
    m.id                                                  as member_id,
    coalesce(si.assignment_type, 'primary'::text)         as assignment_type,
    (si.id is not null)                                   as is_explicit,
    si.replaces_member_id                                 as is_substitute_for_member_id
  from public.training_sessions s
  join public.group_members gm on gm.group_id = s.group_id
  join public.members       m  on m.id = gm.member_id and m.tenant_id = s.tenant_id
  left join public.session_instructors si
         on si.session_id = s.id and si.member_id = m.id
  where si.id is not null
     or (
       not exists (select 1 from public.session_instructors si2 where si2.session_id = s.id)
       and (
         exists (
           select 1 from public.member_roles mr
            where mr.member_id = m.id and mr.role = 'trainer'
         )
         or exists (
           select 1
             from public.tenant_member_roles tmr
             join public.tenant_roles tr on tr.id = tmr.role_id
            where tmr.member_id = m.id
              and tmr.tenant_id = s.tenant_id
              and tr.is_trainer_role = true
         )
       )
     )

  union all

  -- Branch 2: expliciete sessie-instructeur die geen lid is van de groep
  -- (substitute/observer/extern). Identiek aan Sprint 57.
  select
    s.id                  as session_id,
    s.tenant_id,
    si.member_id,
    si.assignment_type,
    true                  as is_explicit,
    si.replaces_member_id as is_substitute_for_member_id
  from public.training_sessions s
  join public.session_instructors si on si.session_id = s.id
  where not exists (
    select 1 from public.group_members gm
     where gm.group_id = s.group_id and gm.member_id = si.member_id
  )

  union all

  -- Branch 3 (Sprint 61): program_default-fallback.
  -- Vuurt alleen wanneer:
  --   (a) sessie aan een program hangt,
  --   (b) er GEEN expliciete sessie-instructeur is, en
  --   (c) er GEEN group-trainer-fallback rijen zijn (zelfde dubbele
  --       check als branch 1 zodat we geen rijen dupliceren).
  select
    s.id                                                  as session_id,
    s.tenant_id,
    pi.member_id,
    coalesce(pi.assignment_type, 'primary'::text)         as assignment_type,
    false                                                 as is_explicit,
    null::uuid                                            as is_substitute_for_member_id
  from public.training_sessions s
  join public.programs            p  on p.id = s.program_id
  join public.program_instructors pi on pi.program_id = p.id
                                    and pi.tenant_id  = s.tenant_id
  where s.program_id is not null
    and not exists (
      select 1 from public.session_instructors si where si.session_id = s.id
    )
    and not exists (
      select 1
        from public.group_members gm
        join public.members m on m.id = gm.member_id and m.tenant_id = s.tenant_id
       where gm.group_id = s.group_id
         and (
           exists (
             select 1 from public.member_roles mr
              where mr.member_id = m.id and mr.role = 'trainer'
           )
           or exists (
             select 1
               from public.tenant_member_roles tmr
               join public.tenant_roles tr on tr.id = tmr.role_id
              where tmr.member_id = m.id
                and tmr.tenant_id = s.tenant_id
                and tr.is_trainer_role = true
           )
         )
    );

comment on view public.session_instructors_effective is
  'Sprint 61: 3-laagse fallback — explicit session_instructors → group-trainer (member_roles OR tenant_roles.is_trainer_role) → program_instructors (alleen wanneer program_id is set én vorige twee lagen leeg).';

-- ═════════════════════════════════════════════════════════════════
-- 5. RPC `detect_instructor_conflicts` rewrite — voeg
--    `programs.default_min_instructors` toe als derde laag in de
--    understaffed-coalesce.
--
--    Branches 1/2/3/3b zijn semantisch ongewijzigd t.o.v. Sprint 59;
--    alleen branch 4 (understaffed) krijgt een extra `left join programs`
--    en breidt de coalesce uit. Voor sessies zonder program_id geeft
--    `p.default_min_instructors` NULL → identieke uitkomst.
-- ═════════════════════════════════════════════════════════════════
create or replace function public.detect_instructor_conflicts(
  p_tenant_id uuid,
  p_from      timestamptz,
  p_to        timestamptz
)
returns table (
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
    and s1.id < s2.id

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

  -- 3. Sessie buiten de geconfigureerde wekelijkse beschikbaarheid.
  select
    'not_available_weekly'::text  as conflict_kind,
    s.id                          as session_id,
    s.starts_at                   as session_starts_at,
    s.ends_at                     as session_ends_at,
    e.member_id                   as member_id,
    'buiten wekelijkse beschikbaarheid' as detail
  from public.training_sessions s
  join public.session_instructors_effective e on e.session_id = s.id
  where s.tenant_id = p_tenant_id
    and s.starts_at >= p_from and s.starts_at < p_to
    and s.status = 'scheduled'
    and exists (
      select 1
        from public.instructor_availability ia_any
       where ia_any.tenant_id = p_tenant_id
         and ia_any.member_id = e.member_id
         and ia_any.day_of_week = ((extract(isodow from s.starts_at)::int) - 1)
         and ia_any.availability_type in ('available','preferred')
         and (ia_any.valid_from  is null or ia_any.valid_from  <= s.starts_at::date)
         and (ia_any.valid_until is null or ia_any.valid_until >= s.starts_at::date)
    )
    and not exists (
      select 1
        from public.instructor_availability ia_cov
       where ia_cov.tenant_id = p_tenant_id
         and ia_cov.member_id = e.member_id
         and ia_cov.day_of_week = ((extract(isodow from s.starts_at)::int) - 1)
         and ia_cov.availability_type in ('available','preferred')
         and (ia_cov.valid_from  is null or ia_cov.valid_from  <= s.starts_at::date)
         and (ia_cov.valid_until is null or ia_cov.valid_until >= s.starts_at::date)
         and ia_cov.start_time <= (s.starts_at::time)
         and ia_cov.end_time   >= (s.ends_at::time)
    )

  union all

  -- 3b. Backward-compat: expliciet 'unavailable'-rij die sessie raakt.
  select
    'not_available_weekly'::text  as conflict_kind,
    s.id                          as session_id,
    s.starts_at                   as session_starts_at,
    s.ends_at                     as session_ends_at,
    e.member_id                   as member_id,
    'wekelijks niet beschikbaar'  as detail
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

  -- 4. Understaffed — Sprint 61: cascade
  --    `coalesce(session.min_instructors, group.default_min_instructors,
  --     program.default_min_instructors, 1)`.
  --    `left join programs p on p.id = s.program_id` levert NULL voor
  --    sessies zonder program_id → identiek gedrag aan Sprint 59.
  select
    'understaffed'::text         as conflict_kind,
    s.id                         as session_id,
    s.starts_at                  as session_starts_at,
    s.ends_at                    as session_ends_at,
    null::uuid                   as member_id,
    ('need=' || coalesce(s.min_instructors, g.default_min_instructors, p.default_min_instructors, 1)::text
       || ' have=' || coalesce(prim.cnt, 0)::text) as detail
  from public.training_sessions s
  join public.groups   g on g.id = s.group_id
  left join public.programs p on p.id = s.program_id
  left join (
    select session_id, count(*)::int as cnt
      from public.session_instructors_effective
     where assignment_type = 'primary'
     group by session_id
  ) prim on prim.session_id = s.id
  where s.tenant_id = p_tenant_id
    and s.starts_at >= p_from and s.starts_at < p_to
    and coalesce(prim.cnt, 0)
        < coalesce(s.min_instructors, g.default_min_instructors, p.default_min_instructors, 1);
$$;

-- ═════════════════════════════════════════════════════════════════
-- 6. Verificatie-queries (als comment).
--
--   -- nieuwe tabellen leeg na migratie:
--   select count(*) from public.program_instructors;   -- 0
--   select count(*) from public.program_resources;     -- 0
--
--   -- composite FK's aanwezig:
--   select conname from pg_constraint where conname in (
--     'training_sessions_id_tenant_uq',
--     'training_sessions_program_tenant_fk',
--     'program_instructors_program_tenant_fk',
--     'program_instructors_member_tenant_fk',
--     'program_resources_program_tenant_fk',
--     'program_resources_resource_tenant_fk'
--   );
--
--   -- Houtrust-snapshot moet identiek zijn (vóór en ná migratie):
--   select session_id, member_id, assignment_type, is_explicit
--     from public.session_instructors_effective
--    where tenant_id = (select id from public.tenants where slug='voetbalschool-houtrust')
--    order by session_id, member_id;
-- ═════════════════════════════════════════════════════════════════
