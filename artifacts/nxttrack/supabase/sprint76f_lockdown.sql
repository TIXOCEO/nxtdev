-- ═════════════════════════════════════════════════════════════════
-- Sprint 76f — Lockdown record_capacity_available_event (security-fix)
--
-- Sprint76e gaf `grant execute ... to authenticated` aan een
-- security-definer helper zonder authz-guard. Resultaat: elke
-- ingelogde user kon arbitrair events/notificaties triggeren
-- (spam-vector + cross-tenant). Reviewer rejected.
--
-- Fix:
--   1. REVOKE execute van authenticated en public — alleen triggers
--      en service-role-clients (admin-client in TS) mogen 'm draaien.
--      Triggers _trg_capacity_member_removed en _trg_capacity_groups_increased
--      zijn zelf security-definer en draaien onder de table-owner, dus
--      die blijven werken zonder grant aan `authenticated`.
--   2. Belt-and-braces guard binnen de functie: voor elke side-effect
--      check `has_tenant_access(v_tenant)`. De check accepteert
--      service-role (admin-client bypasst RLS) en de table-owner-
--      context van triggers; weigert ingelogde gewone users.
-- ═════════════════════════════════════════════════════════════════

revoke execute on function public.record_capacity_available_event(uuid, text, int) from public;
revoke execute on function public.record_capacity_available_event(uuid, text, int) from authenticated;

create or replace function public.record_capacity_available_event(
  p_group_id uuid,
  p_source   text,
  p_freed    int default 1
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant      uuid;
  v_program     uuid;
  v_group_name  text;
  v_event_id    uuid;
  v_candidates  int;
  v_recipients  jsonb;
  v_title       text;
  v_content     text;
  v_role        text;
begin
  select g.tenant_id, g.program_id, g.name
    into v_tenant, v_program, v_group_name
  from public.groups g
  where g.id = p_group_id;

  if v_tenant is null then
    return null;
  end if;

  -- Belt-and-braces authz: alleen service-role, postgres-owner of
  -- een user met expliciete tenant-toegang mag side-effects veroorzaken.
  -- Triggers draaien als 'postgres' (table-owner) en omzeilen deze check.
  -- Admin-client (service_role) bypasst RLS sowieso.
  v_role := current_setting('request.jwt.claim.role', true);
  if coalesce(v_role, '') <> 'service_role'
     and current_user <> 'postgres'
     and not public.has_tenant_access(v_tenant) then
    raise exception 'access denied to record capacity event for tenant %', v_tenant
      using errcode = '42501';
  end if;

  -- Tel kandidaten (waitlisted submissions + waiting entries met
  -- program-overlap of program-null één-zijde).
  select count(*)
    into v_candidates
  from (
    select s.id
      from public.intake_submissions s
     where s.tenant_id = v_tenant
       and s.status = 'waitlisted'
       and (v_program is null or s.program_id is null or s.program_id = v_program)
    union all
    select we.id
      from public.waitlist_entries we
     where we.tenant_id = v_tenant
       and we.status = 'waiting'
       and (v_program is null or we.program_id is null or we.program_id = v_program)
  ) t;

  -- Insert event; day-dedup via unique index → unique_violation catch.
  begin
    insert into public.capacity_available_events
      (tenant_id, group_id, trigger_source, freed_seats,
       candidate_count, status)
    values
      (v_tenant, p_group_id, p_source, greatest(p_freed, 1),
       v_candidates, 'open')
    returning id into v_event_id;
  exception
    when unique_violation then
      select id into v_event_id
        from public.capacity_available_events
       where tenant_id = v_tenant
         and group_id  = p_group_id
         and ((created_at at time zone 'UTC')::date)
             = ((now() at time zone 'UTC')::date)
       order by created_at asc
       limit 1;
      return v_event_id;
  end;

  -- Notify in dezelfde transactie, exception-tolerant.
  begin
    select coalesce(
      jsonb_agg(
        jsonb_build_object('member_id', m.id::text, 'user_id', m.user_id::text)
      ),
      '[]'::jsonb
    )
      into v_recipients
    from public.members m
    join public.member_roles mr on mr.member_id = m.id
    where m.tenant_id = v_tenant
      and m.user_id is not null
      and m.member_status = 'active'
      and mr.role = 'tenant_admin';

    v_title := 'Plek vrijgekomen in groep ' || coalesce(v_group_name, 'onbekend')
            || ' — ' || v_candidates::text
            || case when v_candidates = 1 then ' kandidaat' else ' kandidaten' end;

    v_content := 'Er ' ||
      case when greatest(p_freed,1) = 1 then 'is 1 plek' else 'zijn ' || p_freed::text || ' plekken' end ||
      ' vrijgekomen in ' || coalesce(v_group_name, 'een groep') || '. ' ||
      v_candidates::text || ' wachtende ' ||
      case when v_candidates = 1 then 'kandidaat' else 'kandidaten' end ||
      ' gevonden. Open de placement-assistent om af te handelen.';

    perform public.create_notification_with_recipients(
      v_tenant,
      v_title,
      null,
      v_content,
      'capacity_available_candidates',
      v_event_id,
      null,
      jsonb_build_array(
        jsonb_build_object('target_type','role','target_id','tenant_admin')
      ),
      v_recipients
    );
  exception
    when others then
      raise warning '[capacity_event] notify failed for event %: %',
        v_event_id, sqlerrm;
  end;

  return v_event_id;
end $$;

-- Geen grant aan authenticated. Alleen postgres-owner en service_role
-- (admin-client) krijgen toegang. Triggers draaien als owner.
revoke execute on function public.record_capacity_available_event(uuid, text, int) from public;
revoke execute on function public.record_capacity_available_event(uuid, text, int) from authenticated;

comment on function public.record_capacity_available_event(uuid, text, int) is
  'Sprint 76f: lockdown — alleen aanroepbaar vanuit triggers (postgres-'
  'owner) en service_role. Embedded authz-guard belt-and-braces.';

-- Einde sprint76f_lockdown.sql
