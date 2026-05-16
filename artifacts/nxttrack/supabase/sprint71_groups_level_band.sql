-- ═════════════════════════════════════════════════════════════════
-- Sprint 71 — Niveau-data meenemen in plaatsingssuggesties (v0.27.0)
--
-- 1. Voeg `groups.level_band text null` toe (vrij-tekst label, bv.
--    "Watervrij", "A", "B", "U10").
-- 2. Breid `validate_intake_form` uit met een nieuwe canonical_target
--    `preferred_level`, zodat een formulier-veld kan worden gekoppeld
--    aan de submitter-niveauvoorkeur.
-- 3. Herbouw `score_placement_candidates` zodat `level_match` een
--    echte score retourneert wanneer zowel groep als submitter een
--    niveau hebben (exacte match = 100, mismatch = 0). De rationale
--    legt uit waarom een score 0 is.
--
-- Idempotent: `add column if not exists`, drop+create van functions
-- en triggers volgens Sprint 65/66/70-patroon.
-- ═════════════════════════════════════════════════════════════════

-- ── (1) groups.level_band ─────────────────────────────────────────
alter table public.groups
  add column if not exists level_band text null;

comment on column public.groups.level_band is
  'Sprint 71: vrije-tekst niveau-label per groep (bv. "Watervrij", "A", '
  '"U10"). Gebruikt door score_placement_candidates om submitter-'
  'voorkeur op niveau te matchen. Case-insensitive bij vergelijken.';

-- ── (2) validate_intake_form: nieuwe canonical_target ────────────
-- We droppen en herbouwen de functie zodat het canonical_targets-
-- array de nieuwe waarde bevat. Trigger ongewijzigd.

create or replace function public.validate_intake_form(p_form_id uuid)
returns table(is_valid boolean, errors jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_field_count int;
  v_rec record;
  v_keys text[];
  v_show_if jsonb;
  v_target_key text;
  v_visited text[];
  v_stack text[];
  v_canonical_targets constant text[] := array[
    'contact_name','contact_email','contact_phone',
    'contact_date_of_birth','registration_target',
    'preferred_level'
  ];
  v_types_with_options constant text[] := array['select','multiselect','radio'];
begin
  select count(*) into v_field_count
  from public.intake_form_fields
  where form_id = p_form_id;

  if v_field_count = 0 then
    v_errors := v_errors || jsonb_build_object(
      'code', 'no_fields',
      'message', 'Formulier heeft geen velden.'
    );
    return query select false, v_errors;
    return;
  end if;

  select array_agg(key) into v_keys
  from public.intake_form_fields
  where form_id = p_form_id;

  for v_rec in
    select id, key, label, field_type, options_json, validation_json,
           show_if_json, canonical_target
    from public.intake_form_fields
    where form_id = p_form_id
    order by sort_order asc, created_at asc
  loop
    if v_rec.field_type = any(v_types_with_options) then
      if v_rec.options_json is null
         or jsonb_typeof(v_rec.options_json) <> 'array'
         or jsonb_array_length(v_rec.options_json) = 0 then
        v_errors := v_errors || jsonb_build_object(
          'code', 'missing_options',
          'field_key', v_rec.key,
          'message', format('Veld %s vereist minimaal één optie.', v_rec.key)
        );
      end if;
    end if;

    if v_rec.validation_json is not null
       and v_rec.validation_json ? 'pattern'
       and coalesce(v_rec.validation_json->>'pattern','') <> '' then
      begin
        perform regexp_count('', v_rec.validation_json->>'pattern');
      exception when others then
        v_errors := v_errors || jsonb_build_object(
          'code', 'invalid_pattern',
          'field_key', v_rec.key,
          'message', format('Veld %s heeft een ongeldig validatiepatroon.', v_rec.key)
        );
      end;
    end if;

    if v_rec.canonical_target is not null
       and v_rec.canonical_target <> ''
       and not (v_rec.canonical_target = any(v_canonical_targets)) then
      v_errors := v_errors || jsonb_build_object(
        'code', 'invalid_canonical_target',
        'field_key', v_rec.key,
        'message', format('Veld %s heeft een onbekende canonical_target.', v_rec.key)
      );
    end if;

    if v_rec.show_if_json is not null
       and jsonb_typeof(v_rec.show_if_json) = 'object'
       and v_rec.show_if_json ? 'field_key' then
      v_target_key := v_rec.show_if_json->>'field_key';
      if v_target_key is null or v_target_key = '' then
        v_errors := v_errors || jsonb_build_object(
          'code', 'show_if_empty_target',
          'field_key', v_rec.key,
          'message', format('Veld %s heeft een lege show_if.field_key.', v_rec.key)
        );
      elsif v_target_key = v_rec.key then
        v_errors := v_errors || jsonb_build_object(
          'code', 'show_if_self_reference',
          'field_key', v_rec.key,
          'message', format('Veld %s verwijst in show_if naar zichzelf.', v_rec.key)
        );
      elsif not (v_target_key = any(v_keys)) then
        v_errors := v_errors || jsonb_build_object(
          'code', 'show_if_missing_target',
          'field_key', v_rec.key,
          'target_key', v_target_key,
          'message', format(
            'Veld %s verwijst in show_if naar onbekend veld %s.',
            v_rec.key, v_target_key
          )
        );
      end if;
    end if;
  end loop;

  -- Cycle detection over show_if-graaf (DFS) — ongewijzigd t.o.v. Sprint 66.
  declare
    v_start text;
    v_cur text;
    v_next text;
  begin
    for v_start in
      select key from public.intake_form_fields where form_id = p_form_id
    loop
      v_visited := array[]::text[];
      v_stack := array[v_start];
      while array_length(v_stack, 1) is not null loop
        v_cur := v_stack[array_length(v_stack, 1)];
        v_stack := v_stack[1:array_length(v_stack, 1)-1];
        if v_cur = any(v_visited) then
          continue;
        end if;
        v_visited := v_visited || v_cur;
        select show_if_json into v_show_if
        from public.intake_form_fields
        where form_id = p_form_id and key = v_cur;
        if v_show_if is not null
           and jsonb_typeof(v_show_if) = 'object'
           and v_show_if ? 'field_key' then
          v_next := v_show_if->>'field_key';
          if v_next = v_start then
            v_errors := v_errors || jsonb_build_object(
              'code', 'show_if_cycle',
              'field_key', v_start,
              'message', format('show_if-cyclus gedetecteerd bij veld %s.', v_start)
            );
            exit;
          end if;
          if v_next is not null and v_next <> '' and not (v_next = any(v_visited)) then
            v_stack := v_stack || v_next;
          end if;
        end if;
      end loop;
    end loop;
  end;

  return query select (jsonb_array_length(v_errors) = 0), v_errors;
end $$;

revoke all on function public.validate_intake_form(uuid) from public;
grant execute on function public.validate_intake_form(uuid) to authenticated;

-- ── (3) score_placement_candidates: echte level_match ────────────
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
  v_preferred_level     text;
  v_age_years           numeric;
begin
  select s.tenant_id, s.program_id, s.contact_date_of_birth, coalesce(s.preferences_json, '{}'::jsonb)
    into v_tenant, v_program, v_dob, v_prefs
  from public.intake_submissions s
  where s.id = p_submission_id;

  if v_tenant is null then
    return;
  end if;

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
  -- Sprint 71 — niveau-voorkeur. Canonical key is `preferred_level`,
  -- met fallback naar `current_level` (sector-default swimming gebruikt
  -- die key vóór Sprint 71). Lege string → null.
  v_preferred_level := nullif(
    trim(lower(coalesce(
      v_prefs->>'preferred_level',
      v_prefs->>'current_level'
    ))),
    ''
  );
  v_age_years := case
    when v_dob is null then null
    else extract(year from age(current_date, v_dob))::numeric
  end;

  return query
  with candidate_groups as (
    select distinct g.id as g_id, g.name as g_name,
                    g.program_id as g_program_id,
                    nullif(trim(lower(g.level_band)), '') as g_level_band
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
  ),
  group_capacity as (
    select pco.group_id,
           min(greatest(coalesce(pco.fixed_capacity, 0) - coalesce(pco.used_count, 0), 0))::int as min_free,
           count(*)::int as session_count
    from public.program_capacity_overview pco
    where pco.tenant_id = v_tenant
      and pco.starts_at >= now()
    group by pco.group_id
  ),
  group_sessions as (
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
      case
        when coalesce(gc.min_free, 0) <= 0 then 0
        when gc.min_free >= 3 then 100
        else round(gc.min_free::numeric * 100 / 3)
      end::numeric as capacity_match,
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
      case
        when array_length(v_preferred_locations, 1) is null then 0
        when gs.locations is null then 0
        when exists (
          select 1 from unnest(v_preferred_locations) l
          where lower(l) = any (gs.locations)
        ) then 100
        else 0
      end::numeric as location_pref_match,
      case
        when v_age_years is null then 0
        when gpa.age_min is null and gpa.age_max is null then 0
        when v_age_years between coalesce(gpa.age_min, -1) and coalesce(gpa.age_max, 999) then 100
        when (gpa.age_min is not null and v_age_years >= gpa.age_min - 1 and v_age_years < gpa.age_min)
          or (gpa.age_max is not null and v_age_years >  gpa.age_max and v_age_years <= gpa.age_max + 1) then 50
        else 0
      end::numeric as age_match,
      -- Sprint 71 — echte level_match (exact match = 100, anders 0).
      case
        when v_preferred_level is null then 0
        when cg.g_level_band is null then 0
        when cg.g_level_band = v_preferred_level then 100
        else 0
      end::numeric as level_match,
      gs.dows,
      gs.locations,
      gpa.age_min,
      gpa.age_max,
      cg.g_level_band
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
      'level',
        case
          when v_preferred_level is null then 'geen niveau-voorkeur opgegeven'
          when s.g_level_band is null then 'groep heeft geen niveau-label'
          when s.g_level_band = v_preferred_level then 'niveau match (' || v_preferred_level || ')'
          else 'niveau verschilt — voorkeur ' || v_preferred_level || ', groep ' || s.g_level_band
        end
    ) as rationale_json
  from scored s
  order by total_score desc nulls last, s.free_seats desc nulls last
  limit 50;
end $$;

revoke all on function public.score_placement_candidates(uuid) from public;
grant execute on function public.score_placement_candidates(uuid) to authenticated;

comment on function public.score_placement_candidates(uuid) is
  'Sprint 71: advisory placement scoring voor intake_submissions. '
  'Geeft top-N (max 50) kandidaat-groepen met componentscores op '
  'capacity / time / location / age / level. level_match leest '
  'preferences_json.preferred_level (fallback current_level) en '
  'vergelijkt met groups.level_band (case-insensitive, exact match).';
