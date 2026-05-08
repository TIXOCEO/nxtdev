-- Sprint 59 — Instructor planning bugfix (n.a.v. code-review v0.15.0).
-- Idempotent.
--
-- Wijzigingen:
--  1. detect_instructor_conflicts.not_available_weekly herschreven:
--     vlagt nu sessies die BUITEN de geconfigureerde wekelijkse
--     beschikbaarheid van de instructeur vallen (i.p.v. alleen wanneer
--     er expliciet een 'unavailable'-rij overeen ligt). Als een
--     instructeur géén enkele wekelijkse rij heeft voor die weekdag,
--     wordt er niets gevlagd (= geen voorkeur uitgesproken).
--
-- Ongewijzigd: andere conflict-soorten, view, dedup-index.

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
  --    Trigger: er bestaat ≥1 available/preferred-rij op die weekdag,
  --    maar GEEN enkele rij dekt het volledige sessie-tijdvenster.
  --    Daarnaast: een expliciete 'unavailable'-rij die de sessie raakt
  --    is óók een conflict (achterwaarts compatibel).
  --    Zonder enige wekelijkse rij voor die dag = geen conflict.
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
      -- instructeur heeft op deze weekdag minstens één beschikbaar/voorkeur-rij
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
      -- ...maar geen enkele dekt de sessie volledig
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

  -- 4. Understaffed.
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
