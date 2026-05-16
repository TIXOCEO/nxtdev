-- ═════════════════════════════════════════════════════════════════
-- Sprint 66 hotfix — validate_intake_form tenant-authz guard.
--
-- De originele Sprint 66 RPC was `security definer` + grant
-- `authenticated`, zonder tenant-check binnenin. Daarmee kon iedere
-- ingelogde gebruiker met een willekeurige form-uuid de validatie-
-- output (incl. field_keys via error-objecten) bekijken — een
-- cross-tenant leak.
--
-- Fix: binnen de functie de `tenant_id` ophalen via `intake_forms.id`
-- en `has_tenant_access(tenant_id)` afdwingen. Faalt → raise
-- `insufficient_privilege`. De publish-trigger werkt door omdat die
-- in dezelfde tenant-context als de update zelf draait (de update
-- door een tenant-admin op intake_forms zou anders al door RLS
-- geblokkeerd zijn).
--
-- Idempotent: drop+recreate van de function (de trigger blijft
-- ongewijzigd, die verwijst alleen naar de function-naam).
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
  v_tenant_id uuid;
  v_canonical_targets constant text[] := array[
    'contact_name','contact_email','contact_phone',
    'contact_date_of_birth','registration_target'
  ];
  v_types_with_options constant text[] := array['select','multiselect','radio'];
begin
  -- Tenant-authz guard: form moet bestaan + caller moet tenant-access
  -- hebben. Onbekende form-id → permission-error (geen existence-leak).
  select tenant_id into v_tenant_id
  from public.intake_forms
  where id = p_form_id;

  if v_tenant_id is null or not public.has_tenant_access(v_tenant_id) then
    raise exception 'Geen toegang tot intake-formulier'
      using errcode = '42501';
  end if;

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

-- Einde sprint66_intake_forms_publish_hotfix.sql.
