-- ═════════════════════════════════════════════════════════════════
-- Sprint 76d — Scoring uitgebreid + strikte day-dedup (review-fix-3)
--
-- 1. find_waitlist_candidates_for: scoring uitgebreid met stage-match
--    (intersectie van submission's recommended/selected_stage_id met
--    group_stages) en preferred_days-match (intersectie van
--    preferences_json->'preferred_days' met dow van toekomstige
--    training_sessions van de groep).
--
--    Schema (totaal 100, FIFO tiebreaker):
--      stage match           : 40
--      program match         : 25
--      age fit               : 20
--      preferred_days fit    : 15
--      program-null one-side : 12 (zwakkere fallback i.p.v. 25)
--
-- 2. capacity_available_events: dedup is nu strict per
--    (tenant_id, group_id, dag) regardless of status. Drop+recreate
--    van het index zonder where-clausule. Tabel is leeg op DEV en
--    bevat alleen test-rijen op PROD — geen merge nodig.
--
-- Idempotent.
-- ═════════════════════════════════════════════════════════════════

-- 1. Strikte day-dedup ────────────────────────────────────────────
drop index if exists public.capacity_available_events_daily_uq;

-- Verwijder duplicaten (zelfde dag/groep/tenant) — bewaar de oudste.
delete from public.capacity_available_events e
 using (
   select tenant_id, group_id,
          ((created_at at time zone 'UTC')::date) as d,
          min(created_at) as keep_at
     from public.capacity_available_events
    group by tenant_id, group_id, d
   having count(*) > 1
 ) dup
 where e.tenant_id = dup.tenant_id
   and e.group_id  = dup.group_id
   and ((e.created_at at time zone 'UTC')::date) = dup.d
   and e.created_at <> dup.keep_at;

create unique index if not exists capacity_available_events_daily_uq
  on public.capacity_available_events
     (tenant_id, group_id, ((created_at at time zone 'UTC')::date));

comment on index public.capacity_available_events_daily_uq is
  'Sprint 76d: strict day-dedup per (tenant_id, group_id, dag) — '
  'geldt voor alle statussen, voorkomt herhaalde events na handle/dismiss.';

-- 2. find_waitlist_candidates_for — stage + preferred_days scoring
drop function if exists public.find_waitlist_candidates_for(uuid, int);

create or replace function public.find_waitlist_candidates_for(
  p_group_id uuid,
  p_limit    int default 10
) returns table(
  source_type     text,
  candidate_id    uuid,
  contact_name    text,
  contact_email   text,
  program_id      uuid,
  program_name    text,
  score           int,
  created_at      timestamptz,
  status          text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant        uuid;
  v_group_program uuid;
  v_group_days    int[];
  v_group_stages  uuid[];
begin
  select g.tenant_id, g.program_id
    into v_tenant, v_group_program
  from public.groups g
  where g.id = p_group_id;

  if v_tenant is null then
    return;
  end if;

  if not public.has_tenant_access(v_tenant) then
    raise exception 'access denied for group %', p_group_id
      using errcode = '42501';
  end if;

  -- Aggregeer dagen van toekomstige sessies (volgende 8 weken).
  select coalesce(array_agg(distinct extract(dow from starts_at)::int), '{}'::int[])
    into v_group_days
  from public.training_sessions
  where group_id = p_group_id
    and starts_at > now()
    and starts_at < now() + interval '56 days';

  -- Aggregeer stage-ids van de groep.
  select coalesce(array_agg(stage_id), '{}'::uuid[])
    into v_group_stages
  from public.group_stages
  where group_id = p_group_id
    and tenant_id = v_tenant;

  return query
  with combined as (
    -- (a) intake_submissions — volledige scoring
    select
      'intake_submission'::text                          as source_type,
      s.id                                               as candidate_id,
      coalesce(s.contact_name, '')                       as contact_name,
      s.contact_email                                    as contact_email,
      s.program_id                                       as program_id,
      coalesce(ps.name, '')                              as program_name,
      (
        -- program-match (25) of zwakke fallback (12).
        case
          when v_group_program is not null and s.program_id = v_group_program then 25
          when v_group_program is null or s.program_id is null then 12
          else 0
        end
        +
        -- stage-match (40): submission's voorgestelde/gekozen stage
        -- staat in de stages van deze groep.
        case
          when coalesce(s.selected_stage_id, s.recommended_stage_id) is not null
           and coalesce(s.selected_stage_id, s.recommended_stage_id) = any(v_group_stages)
          then 40 else 0
        end
        +
        -- age-fit (20).
        case
          when ps.age_min is null and ps.age_max is null then 0
          when s.contact_date_of_birth is null then 0
          when extract(year from age(s.contact_date_of_birth))
               between coalesce(ps.age_min, 0) and coalesce(ps.age_max, 150)
            then 20
          else 0
        end
        +
        -- preferred_days (15): array van numerieke dow's (0-6) of
        -- engelse dagnamen in preferences_json->'preferred_days'.
        case
          when array_length(v_group_days, 1) is null then 0
          when s.preferences_json is null then 0
          when not (s.preferences_json ? 'preferred_days') then 0
          when exists (
            select 1
            from jsonb_array_elements_text(
              coalesce(s.preferences_json->'preferred_days', '[]'::jsonb)
            ) as d(val)
            where (
              -- numeric dow
              case when d.val ~ '^[0-6]$' then d.val::int end
              = any(v_group_days)
            ) or (
              -- engelse dagnaam (lowercase) → dow
              case lower(d.val)
                when 'sunday'    then 0
                when 'monday'    then 1
                when 'tuesday'   then 2
                when 'wednesday' then 3
                when 'thursday'  then 4
                when 'friday'    then 5
                when 'saturday'  then 6
              end = any(v_group_days)
            ) or (
              -- nederlandse dagnaam
              case lower(d.val)
                when 'zondag'    then 0
                when 'maandag'   then 1
                when 'dinsdag'   then 2
                when 'woensdag'  then 3
                when 'donderdag' then 4
                when 'vrijdag'   then 5
                when 'zaterdag'  then 6
              end = any(v_group_days)
            )
          ) then 15 else 0
        end
      )::int                                             as score,
      s.created_at                                       as created_at,
      s.status                                           as status
    from public.intake_submissions s
    left join public.programs ps
           on ps.id = s.program_id and ps.tenant_id = v_tenant
    where s.tenant_id = v_tenant
      and s.status = 'waitlisted'
      and (
        v_group_program is null
        or s.program_id is null
        or s.program_id = v_group_program
      )

    union all

    -- (b) waitlist_entries — minimale scoring (geen stage/days).
    select
      'waitlist_entry'::text                             as source_type,
      we.id                                              as candidate_id,
      coalesce(we.contact_name, '')                      as contact_name,
      we.contact_email                                   as contact_email,
      we.program_id                                      as program_id,
      coalesce(pw.name, '')                              as program_name,
      (
        case
          when v_group_program is not null and we.program_id = v_group_program then 25
          when v_group_program is null or we.program_id is null then 12
          else 0
        end
      )::int                                             as score,
      we.created_at                                      as created_at,
      we.status                                          as status
    from public.waitlist_entries we
    left join public.programs pw
           on pw.id = we.program_id and pw.tenant_id = v_tenant
    where we.tenant_id = v_tenant
      and we.status = 'waiting'
      and (
        v_group_program is null
        or we.program_id is null
        or we.program_id = v_group_program
      )
  )
  select * from combined
   order by score desc, created_at asc
   limit greatest(p_limit, 1);
end $$;

revoke all on function public.find_waitlist_candidates_for(uuid, int) from public;
grant execute on function public.find_waitlist_candidates_for(uuid, int) to authenticated;

comment on function public.find_waitlist_candidates_for(uuid, int) is
  'Sprint 76d: top-N wachtlijst-kandidaten met scoring stage(40) + '
  'program(25) + age(20) + preferred_days(15), FIFO als tiebreaker.';

-- Einde sprint76d_scoring_and_dedup.sql
