-- Sprint 72 hotfix #2 — RPC returnt nu target_stage_color zodat de
-- placement-UI een gekleurde stage-badge kan renderen (review-finding).

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
  v_preferred_level     text;
  v_age_years           numeric;
  v_selected_stage      uuid;
  v_recommended_stage   uuid;
  v_target_stage        uuid;
  v_target_stage_program uuid;
  v_target_stage_name   text;
  v_target_stage_color  text;
  v_target_mismatch     boolean := false;
  v_program_use_stages  boolean := false;
begin
  select s.tenant_id, s.program_id, s.contact_date_of_birth,
         coalesce(s.preferences_json, '{}'::jsonb),
         s.selected_stage_id, s.recommended_stage_id
    into v_tenant, v_program, v_dob, v_prefs,
         v_selected_stage, v_recommended_stage
  from public.intake_submissions s
  where s.id = p_submission_id;

  if v_tenant is null then return; end if;
  if not public.has_tenant_access(v_tenant) then
    raise exception 'access denied for submission %', p_submission_id using errcode = '42501';
  end if;

  v_preferred_days := coalesce(array(select jsonb_array_elements_text(v_prefs->'preferred_days')), array[]::text[]);
  v_preferred_locations := coalesce(array(select jsonb_array_elements_text(v_prefs->'preferred_locations')), array[]::text[]);
  v_preferred_level := nullif(trim(lower(coalesce(v_prefs->>'preferred_level', v_prefs->>'current_level'))), '');
  v_age_years := case when v_dob is null then null else extract(year from age(current_date, v_dob))::numeric end;

  if v_program is not null then
    select use_stages into v_program_use_stages from public.programs where id = v_program and tenant_id = v_tenant;
  end if;

  v_target_stage := coalesce(v_selected_stage, v_recommended_stage);
  if v_target_stage is not null then
    select program_id into v_target_stage_program from public.program_stages where id = v_target_stage and tenant_id = v_tenant;
    if v_program is not null and v_target_stage_program is not null and v_target_stage_program <> v_program then
      v_target_stage := null;
      v_target_mismatch := true;
    end if;
  end if;
  if v_target_stage is null and v_program is not null and v_preferred_level is not null then
    select id into v_target_stage
    from public.program_stages
    where tenant_id = v_tenant and program_id = v_program
      and archived_at is null and lower(trim(name)) = v_preferred_level
    limit 1;
  end if;
  if v_target_stage is not null then
    select name, color into v_target_stage_name, v_target_stage_color
    from public.program_stages where id = v_target_stage;
  end if;

  return query
  with candidate_groups as (
    select distinct g.id as g_id, g.name as g_name, g.program_id as g_program_id
    from public.groups g
    where g.tenant_id = v_tenant
      and (v_program is null or g.program_id = v_program
        or exists (select 1 from public.program_groups pg
                   where pg.tenant_id = v_tenant and pg.group_id = g.id and pg.program_id = v_program))
  ),
  group_capacity as (
    select pco.group_id,
           min(greatest(coalesce(pco.fixed_capacity, 0) - coalesce(pco.used_count, 0), 0))::int as min_free,
           count(*)::int as session_count
    from public.program_capacity_overview pco
    where pco.tenant_id = v_tenant and pco.starts_at >= now()
    group by pco.group_id
  ),
  group_sessions as (
    select ts.group_id,
           array_agg(distinct extract(dow from ts.starts_at)::int) as dows,
           array_agg(distinct lower(ts.location)) filter (where ts.location is not null) as locations
    from public.training_sessions ts
    where ts.tenant_id = v_tenant and ts.starts_at >= now() and ts.status <> 'cancelled'
    group by ts.group_id
  ),
  group_program_age as (
    select cg.g_id,
           coalesce(p1.age_min, p2.age_min) as age_min,
           coalesce(p1.age_max, p2.age_max) as age_max
    from candidate_groups cg
    left join public.programs p1 on p1.id = cg.g_program_id and p1.tenant_id = v_tenant
    left join public.programs p2 on p2.id = v_program       and p2.tenant_id = v_tenant
  ),
  group_stage_names as (
    select gs.group_id,
           array_agg(distinct ps.name order by ps.name) as stage_names,
           bool_or(ps.id = v_target_stage) as has_target_stage
    from public.group_stages gs
    join public.program_stages ps on ps.id = gs.stage_id and ps.tenant_id = gs.tenant_id
    where gs.tenant_id = v_tenant and ps.archived_at is null
    group by gs.group_id
  ),
  scored as (
    select cg.g_id as group_id, null::uuid as session_id,
      coalesce(gc.min_free, 0) as free_seats, gc.session_count,
      case when coalesce(gc.min_free, 0) <= 0 then 0
           when gc.min_free >= 3 then 100
           else round(gc.min_free::numeric * 100 / 3) end::numeric as capacity_match,
      case when array_length(v_preferred_days, 1) is null then 0
           when gs.dows is null then 0
           when exists (select 1 from unnest(v_preferred_days) d where public._placement_dow(d) = any(gs.dows)) then 100
           when exists (select 1 from unnest(v_preferred_days) d
                        where public._placement_dow(d) >= 0
                          and (((public._placement_dow(d) + 1) % 7) = any(gs.dows)
                            or ((public._placement_dow(d) + 6) % 7) = any(gs.dows))) then 50
           else 0 end::numeric as time_pref_match,
      case when array_length(v_preferred_locations, 1) is null then 0
           when gs.locations is null then 0
           when exists (select 1 from unnest(v_preferred_locations) l where lower(l) = any(gs.locations)) then 100
           else 0 end::numeric as location_pref_match,
      case when v_age_years is null then 0
           when gpa.age_min is null and gpa.age_max is null then 0
           when v_age_years between coalesce(gpa.age_min, -1) and coalesce(gpa.age_max, 999) then 100
           when (gpa.age_min is not null and v_age_years >= gpa.age_min - 1 and v_age_years < gpa.age_min)
             or (gpa.age_max is not null and v_age_years >  gpa.age_max and v_age_years <= gpa.age_max + 1) then 50
           else 0 end::numeric as age_match,
      case when not v_program_use_stages then 0
           when v_target_stage is null then 0
           when coalesce(gsn.has_target_stage, false) then 100
           else 0 end::numeric as level_match,
      gs.dows, gs.locations, gpa.age_min, gpa.age_max,
      gsn.stage_names, gsn.has_target_stage
    from candidate_groups cg
    left join group_capacity    gc  on gc.group_id = cg.g_id
    left join group_sessions    gs  on gs.group_id = cg.g_id
    left join group_program_age gpa on gpa.g_id    = cg.g_id
    left join group_stage_names gsn on gsn.group_id = cg.g_id
  )
  select s.group_id, s.session_id,
    round(0.30*s.capacity_match + 0.25*s.time_pref_match + 0.20*s.location_pref_match
        + 0.15*s.age_match + 0.10*s.level_match, 2) as total_score,
    s.capacity_match, s.time_pref_match, s.location_pref_match, s.age_match, s.level_match,
    s.free_seats,
    jsonb_build_object(
      'capacity', case when coalesce(s.session_count, 0) = 0 then 'geen toekomstige sessies'
                       when s.free_seats > 0 then s.free_seats || ' vrije plaats(en)' else 'vol' end,
      'time', case when array_length(v_preferred_days, 1) is null then 'geen dagvoorkeur opgegeven'
                   when s.dows is null then 'geen toekomstige sessies bekend'
                   else 'voorkeur ' || array_to_string(v_preferred_days, ', ') end,
      'location', case when array_length(v_preferred_locations, 1) is null then 'geen locatievoorkeur opgegeven'
                       when s.locations is null then 'geen sessie-locaties bekend'
                       else 'voorkeur ' || array_to_string(v_preferred_locations, ', ') end,
      'age', case when v_age_years is null then 'leeftijd onbekend'
                  when s.age_min is null and s.age_max is null then 'geen leeftijdsrange ingesteld op programma'
                  else 'leeftijd ' || v_age_years::text || 'j vs '
                       || coalesce(s.age_min::text, '?') || '–' || coalesce(s.age_max::text, '?') end,
      'level', case when not v_program_use_stages then 'stages niet ingeschakeld voor dit programma'
                    when v_target_mismatch then 'opgegeven stage hoort niet bij submission-programma — genegeerd'
                    when v_target_stage is null and v_preferred_level is null then 'geen niveau-voorkeur opgegeven'
                    when v_target_stage is null then 'voorkeur ' || coalesce(v_preferred_level, '?') || ' — geen matchende stage in programma'
                    when coalesce(s.has_target_stage, false) then 'stage-match (' || coalesce(v_target_stage_name, '?') || ')'
                    when s.stage_names is null then 'groep heeft geen stages — voorkeur ' || coalesce(v_target_stage_name, '?')
                    else 'voorkeur ' || coalesce(v_target_stage_name, '?') || ', groep heeft ' || array_to_string(s.stage_names, ', ') end,
      'group_stage_names', coalesce(to_jsonb(s.stage_names), '[]'::jsonb),
      'target_stage_name',  coalesce(to_jsonb(v_target_stage_name),  'null'::jsonb),
      'target_stage_color', coalesce(to_jsonb(v_target_stage_color), 'null'::jsonb)
    ) as rationale_json
  from scored s
  order by total_score desc nulls last, s.free_seats desc nulls last
  limit 50;
end $$;

revoke all on function public.score_placement_candidates(uuid) from public;
grant execute on function public.score_placement_candidates(uuid) to authenticated;
