-- ═════════════════════════════════════════════════════════════════
-- Sprint 70 — Placement-assistent (advisory) (v0.26.0)
--
-- RPC score_placement_candidates(p_submission_id uuid) returnt een
-- ranked top-N kandidaat-groepen voor een intake_submission met
-- componentscores op capacity / time / location / age / level.
--
-- Adapter t.o.v. research §9: het huidige `groups`-schema heeft géén
-- `age_min/age_max/default_location/level_band` kolommen. We leiden
-- daarom af:
--   * age_match  ← programs.age_min/age_max (via group.program_id of
--                  het submission.program_id wanneer set)
--   * location   ← training_sessions.location (per groep aggregaat)
--   * level      ← 0 + rationale "niveau-data nog niet beschikbaar"
--                  (placeholder zodat de signature stabiel blijft als
--                  later groups/programs een level_band-kolom krijgt)
--
-- Tenant-authz: security definer met expliciete has_tenant_access-
-- guard binnen de body (Sprint-66-pattern voor RPC's die over
-- tenant-data scannen).
--
-- Idempotent: drop + create van RPC + helper.
-- ═════════════════════════════════════════════════════════════════

-- Helper: weekday-string → ISO dow (0=zon,1=maa,...,6=zat)
create or replace function public._placement_dow(p text)
returns int
language sql immutable
as $$
  select case lower(p)
    when 'sun' then 0 when 'zo' then 0 when 'zondag' then 0
    when 'mon' then 1 when 'ma' then 1 when 'maandag' then 1
    when 'tue' then 2 when 'di' then 2 when 'dinsdag' then 2
    when 'wed' then 3 when 'wo' then 3 when 'woensdag' then 3
    when 'thu' then 4 when 'do' then 4 when 'donderdag' then 4
    when 'fri' then 5 when 'vr' then 5 when 'vrijdag' then 5
    when 'sat' then 6 when 'za' then 6 when 'zaterdag' then 6
    else -1
  end
$$;

drop function if exists public.score_placement_candidates(uuid);

create or replace function public.score_placement_candidates(p_submission_id uuid)
returns table(
  group_id            uuid,
  session_id          uuid,
  total_score         numeric,
  capacity_match      numeric,
  time_pref_match     numeric,
  location_pref_match numeric,
  age_match           numeric,
  level_match         numeric,
  free_seats          int,
  rationale_json      jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant              uuid;
  v_program             uuid;
  v_dob                 date;
  v_prefs               jsonb;
  v_preferred_days      text[];
  v_preferred_locations text[];
  v_age_years           numeric;
begin
  select s.tenant_id, s.program_id, s.contact_date_of_birth, coalesce(s.preferences_json, '{}'::jsonb)
    into v_tenant, v_program, v_dob, v_prefs
  from public.intake_submissions s
  where s.id = p_submission_id;

  -- Onbekende submission → leeg result (geen exception zodat de UI een
  -- "geen suggesties" lege-state kan tonen i.p.v. te crashen).
  if v_tenant is null then
    return;
  end if;

  -- Tenant-authz guard (Sprint-66 hotfix-pattern: security definer
  -- vereist expliciete check binnen de body).
  if not public.has_tenant_access(v_tenant) then
    raise exception 'access denied for submission %', p_submission_id
      using errcode = '42501';
  end if;

  v_preferred_days := coalesce(
    array(select jsonb_array_elements_text(v_prefs->'preferred_days')),
    array[]::text[]
  );
  v_preferred_locations := coalesce(
    array(select jsonb_array_elements_text(v_prefs->'preferred_locations')),
    array[]::text[]
  );
  v_age_years := case
    when v_dob is null then null
    else extract(year from age(current_date, v_dob))::numeric
  end;

  return query
  with candidate_groups as (
    -- Max 50 kandidaten. Wanneer submission.program_id gezet is →
    -- alleen groepen die aan dat program hangen (g.program_id of via
    -- program_groups). Anders alle tenant-groepen.
    select distinct g.id as g_id, g.name as g_name, g.program_id as g_program_id
    from public.groups g
    where g.tenant_id = v_tenant
      and (
        v_program is null
        or g.program_id = v_program
        or exists (
          select 1 from public.program_groups pg
          where pg.tenant_id = v_tenant
            and pg.group_id = g.id
            and pg.program_id = v_program
        )
      )
    limit 50
  ),
  group_capacity as (
    -- Minimaal aantal vrije plekken over alle toekomstige sessies
    -- van de groep. Geen sessies → null (= behandel als "vol/geen
    -- data" → score 0).
    select pco.group_id,
           min(greatest(coalesce(pco.fixed_capacity, 0) - coalesce(pco.used_count, 0), 0))::int as min_free,
           count(*)::int as session_count
    from public.program_capacity_overview pco
    where pco.tenant_id = v_tenant
      and pco.starts_at >= now()
    group by pco.group_id
  ),
  group_sessions as (
    -- Aggregeer toekomstige niet-afgelaste sessies per groep:
    -- weekdagen + (lowercase) locaties.
    select ts.group_id,
           array_agg(distinct extract(dow from ts.starts_at)::int) as dows,
           array_agg(distinct lower(ts.location)) filter (where ts.location is not null) as locations
    from public.training_sessions ts
    where ts.tenant_id = v_tenant
      and ts.starts_at >= now()
      and ts.status <> 'cancelled'
    group by ts.group_id
  ),
  group_program_age as (
    -- age cascade: group.program_id → submission.program_id
    select cg.g_id,
           coalesce(p1.age_min, p2.age_min) as age_min,
           coalesce(p1.age_max, p2.age_max) as age_max
    from candidate_groups cg
    left join public.programs p1 on p1.id = cg.g_program_id and p1.tenant_id = v_tenant
    left join public.programs p2 on p2.id = v_program       and p2.tenant_id = v_tenant
  ),
  scored as (
    select
      cg.g_id   as group_id,
      null::uuid as session_id,
      coalesce(gc.min_free, 0) as free_seats,
      gc.session_count,
      -- capacity_match: vol=0, ≥3 vrij=100, lineair tussen
      case
        when coalesce(gc.min_free, 0) <= 0 then 0
        when gc.min_free >= 3 then 100
        else round(gc.min_free::numeric * 100 / 3)
      end::numeric as capacity_match,
      -- time_pref_match: 100 bij match, 50 bij ±1 dag, anders 0
      case
        when array_length(v_preferred_days, 1) is null then 0
        when gs.dows is null then 0
        when exists (
          select 1 from unnest(v_preferred_days) d
          where public._placement_dow(d) = any(gs.dows)
        ) then 100
        when exists (
          select 1 from unnest(v_preferred_days) d
          where public._placement_dow(d) >= 0
            and (((public._placement_dow(d) + 1) % 7) = any(gs.dows)
              or ((public._placement_dow(d) + 6) % 7) = any(gs.dows))
        ) then 50
        else 0
      end::numeric as time_pref_match,
      -- location_pref_match: case-insensitive
      case
        when array_length(v_preferred_locations, 1) is null then 0
        when gs.locations is null then 0
        when exists (
          select 1 from unnest(v_preferred_locations) l
          where lower(l) = any (gs.locations)
        ) then 100
        else 0
      end::numeric as location_pref_match,
      -- age_match (via programs; groups heeft geen age cols)
      case
        when v_age_years is null then 0
        when gpa.age_min is null and gpa.age_max is null then 0
        when v_age_years between coalesce(gpa.age_min, -1) and coalesce(gpa.age_max, 999) then 100
        when (gpa.age_min is not null and v_age_years >= gpa.age_min - 1 and v_age_years < gpa.age_min)
          or (gpa.age_max is not null and v_age_years >  gpa.age_max and v_age_years <= gpa.age_max + 1) then 50
        else 0
      end::numeric as age_match,
      -- level_match: placeholder (geen kolom in huidige schema)
      0::numeric as level_match,
      gs.dows,
      gs.locations,
      gpa.age_min,
      gpa.age_max
    from candidate_groups cg
    left join group_capacity    gc  on gc.group_id = cg.g_id
    left join group_sessions    gs  on gs.group_id = cg.g_id
    left join group_program_age gpa on gpa.g_id    = cg.g_id
  )
  select
    s.group_id,
    s.session_id,
    round(
      0.30 * s.capacity_match
    + 0.25 * s.time_pref_match
    + 0.20 * s.location_pref_match
    + 0.15 * s.age_match
    + 0.10 * s.level_match,
      2
    ) as total_score,
    s.capacity_match,
    s.time_pref_match,
    s.location_pref_match,
    s.age_match,
    s.level_match,
    s.free_seats,
    jsonb_build_object(
      'capacity',
        case
          when coalesce(s.session_count, 0) = 0 then 'geen toekomstige sessies'
          when s.free_seats > 0 then s.free_seats || ' vrije plaats(en)'
          else 'vol'
        end,
      'time',
        case
          when array_length(v_preferred_days, 1) is null then 'geen dagvoorkeur opgegeven'
          when s.dows is null then 'geen toekomstige sessies bekend'
          when s.capacity_match > 0 and array_length(v_preferred_days,1) is not null
               and exists (select 1 from unnest(v_preferred_days) d where public._placement_dow(d) = any(s.dows))
            then 'voorkeur ' || array_to_string(v_preferred_days, ', ') || ' — sessie op match'
          else 'voorkeur ' || array_to_string(v_preferred_days, ', ')
        end,
      'location',
        case
          when array_length(v_preferred_locations, 1) is null then 'geen locatievoorkeur opgegeven'
          when s.locations is null then 'geen sessie-locaties bekend'
          else 'voorkeur ' || array_to_string(v_preferred_locations, ', ')
        end,
      'age',
        case
          when v_age_years is null then 'leeftijd onbekend'
          when s.age_min is null and s.age_max is null then 'geen leeftijdsrange ingesteld op programma'
          else 'leeftijd ' || v_age_years::text || 'j vs '
               || coalesce(s.age_min::text, '?') || '–' || coalesce(s.age_max::text, '?')
        end,
      'level', 'niveau-data nog niet beschikbaar'
    ) as rationale_json
  from scored s
  order by total_score desc nulls last, s.free_seats desc nulls last;
end $$;

revoke all on function public.score_placement_candidates(uuid) from public;
grant execute on function public.score_placement_candidates(uuid) to authenticated;

comment on function public.score_placement_candidates(uuid) is
  'Sprint 70: advisory placement scoring voor intake_submissions. '
  'Geeft top-N (max 50) kandidaat-groepen met componentscores op '
  'capacity / time / location / age / level. Tenant-authz binnen body.';
