-- ═════════════════════════════════════════════════════════════════
-- Sprint 66 — Intake form-builder publish-guard (v0.22.0).
--
-- Bouwt op Sprint 65-fundament:
--   1. validate_intake_form(p_form_id uuid) returns (is_valid bool,
--      errors jsonb). Checks: ≥1 veld, show_if_json.field_key bestaat
--      binnen hetzelfde form, geen cyclische show_if (DFS), options
--      aanwezig voor select/multiselect/radio, validation pattern is
--      syntactisch geldig (regexp_count-probe), canonical_target uit
--      toegestane enum.
--   2. Trigger op intake_forms: before update als status van 'draft'
--      naar 'published' wijzigt → call validate_intake_form, raise
--      exception bij is_valid=false. Stelt admins veilig dat alleen
--      geldige formulieren gepubliceerd worden.
--
-- Idempotent: drop+recreate van function en trigger.
-- ═════════════════════════════════════════════════════════════════

drop function if exists public.validate_intake_form(uuid);

create function public.validate_intake_form(p_form_id uuid)
returns table (is_valid boolean, errors jsonb)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_errors jsonb := '[]'::jsonb;
  v_field_count int := 0;
  v_rec record;
  v_keys text[];
  v_show_if jsonb;
  v_target_key text;
  v_visited text[];
  v_stack text[];
  v_canonical_targets constant text[] := array[
    'contact_name','contact_email','contact_phone',
    'contact_date_of_birth','registration_target'
  ];
  v_types_with_options constant text[] := array['select','multiselect','radio'];
begin
  -- (1) minimaal 1 veld
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

  -- Verzamel alle field-keys
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
    -- (4) options voor select/multiselect/radio
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

    -- (5) validation_json: pattern moet geldige regex zijn
    if v_rec.validation_json is not null
       and jsonb_typeof(v_rec.validation_json) = 'object'
       and v_rec.validation_json ? 'pattern' then
      begin
        perform regexp_count('test', v_rec.validation_json->>'pattern');
      exception when others then
        v_errors := v_errors || jsonb_build_object(
          'code', 'invalid_pattern',
          'field_key', v_rec.key,
          'message', format('Veld %s heeft een ongeldige regex.', v_rec.key)
        );
      end;
    end if;

    -- (6) canonical_target uit toegestane enum
    if v_rec.canonical_target is not null
       and v_rec.canonical_target <> ''
       and not (v_rec.canonical_target = any(v_canonical_targets)) then
      v_errors := v_errors || jsonb_build_object(
        'code', 'invalid_canonical_target',
        'field_key', v_rec.key,
        'message', format('Veld %s heeft een onbekende canonical_target.', v_rec.key)
      );
    end if;

    -- (2) show_if.field_key bestaat binnen hetzelfde form
    if v_rec.show_if_json is not null
       and jsonb_typeof(v_rec.show_if_json) = 'object'
       and v_rec.show_if_json ? 'field_key' then
      v_target_key := v_rec.show_if_json->>'field_key';
      if v_target_key is null or v_target_key = '' then
        v_errors := v_errors || jsonb_build_object(
          'code', 'show_if_empty_target',
          'field_key', v_rec.key,
          'message', format('Veld %s heeft een show-if zonder doel-veld.', v_rec.key)
        );
      elsif not (v_target_key = any(v_keys)) then
        v_errors := v_errors || jsonb_build_object(
          'code', 'show_if_missing_target',
          'field_key', v_rec.key,
          'target_key', v_target_key,
          'message', format('Veld %s verwijst naar onbekend veld %s.', v_rec.key, v_target_key)
        );
      elsif v_target_key = v_rec.key then
        v_errors := v_errors || jsonb_build_object(
          'code', 'show_if_self_reference',
          'field_key', v_rec.key,
          'message', format('Veld %s verwijst in show-if naar zichzelf.', v_rec.key)
        );
      end if;
    end if;
  end loop;

  -- (3) cyclische show_if-detectie via DFS over alle velden
  for v_rec in
    select key, show_if_json
    from public.intake_form_fields
    where form_id = p_form_id
      and show_if_json is not null
      and jsonb_typeof(show_if_json) = 'object'
      and show_if_json ? 'field_key'
  loop
    v_visited := array[v_rec.key];
    v_stack := array[v_rec.show_if_json->>'field_key'];
    while array_length(v_stack, 1) > 0 loop
      v_target_key := v_stack[array_length(v_stack, 1)];
      v_stack := v_stack[1:array_length(v_stack, 1) - 1];
      if v_target_key is null or v_target_key = '' then
        exit;
      end if;
      if v_target_key = any(v_visited) then
        -- cyclus gedetecteerd
        if not (v_errors @> jsonb_build_array(
          jsonb_build_object('code','show_if_cycle','field_key',v_rec.key)
        )) then
          v_errors := v_errors || jsonb_build_object(
            'code', 'show_if_cycle',
            'field_key', v_rec.key,
            'message', format('Veld %s zit in een show-if cyclus.', v_rec.key)
          );
        end if;
        exit;
      end if;
      v_visited := v_visited || v_target_key;
      -- volg de volgende referentie
      select show_if_json into v_show_if
      from public.intake_form_fields
      where form_id = p_form_id and key = v_target_key
      limit 1;
      if v_show_if is not null
         and jsonb_typeof(v_show_if) = 'object'
         and v_show_if ? 'field_key' then
        v_stack := v_stack || (v_show_if->>'field_key');
      end if;
    end loop;
  end loop;

  return query select (jsonb_array_length(v_errors) = 0), v_errors;
end;
$fn$;

revoke all on function public.validate_intake_form(uuid) from public;
grant execute on function public.validate_intake_form(uuid) to authenticated, service_role;

-- Trigger: blokkeer draft→published wanneer validate_intake_form faalt.
drop trigger if exists intake_forms_validate_publish on public.intake_forms;
drop function if exists public.intake_forms_validate_publish();

create function public.intake_forms_validate_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_is_valid boolean;
  v_errors jsonb;
begin
  if new.status = 'published'
     and (old.status is distinct from 'published') then
    select is_valid, errors into v_is_valid, v_errors
    from public.validate_intake_form(new.id);
    if not coalesce(v_is_valid, false) then
      raise exception
        'Intake-formulier kan niet gepubliceerd worden: %', v_errors::text
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$fn$;

create trigger intake_forms_validate_publish
  before update on public.intake_forms
  for each row
  execute function public.intake_forms_validate_publish();

-- Einde sprint66_intake_forms_publish.sql.
