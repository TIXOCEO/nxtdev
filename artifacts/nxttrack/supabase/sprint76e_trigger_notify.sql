-- ═════════════════════════════════════════════════════════════════
-- Sprint 76e — Notify-vanuit-trigger (review-fix-4)
--
-- Reviewer eist dat notificatie in dezelfde transactie als het event
-- ontstaat, vanuit het SQL-pad (zodat imports/scripts/directe DML
-- óók een notificatie krijgen — niet alleen TS-actions).
--
-- Aanpak: `record_capacity_available_event` (security definer, al
-- aanwezig sinds sprint76) wordt uitgebreid met een notify-blok dat:
--   • alleen vuurt bij een nieuw event (niet bij day-dedup-hit);
--   • tenant_admin recipients resolveert via member_roles + members;
--   • `create_notification_with_recipients` aanroept met source
--     `capacity_available_candidates` + source_ref=event-id (dedup
--     erft van de sprint76b RPC + de unique source_ref-key);
--   • in begin/exception/raise-warning gewikkeld is zodat een
--     mislukte notify nooit de DELETE/UPDATE rollbackt.
--
-- TS-helper `notifyCapacityEventIfAny` blijft bestaan als belt-and-
-- braces voor flows die in TS group-namen al gecached hebben; de
-- dedup-key (`source='capacity_available_candidates'` +
-- `source_ref=event_id`) zorgt dat een tweede call no-ops.
--
-- Idempotent (drop+create van de helper).
-- ═════════════════════════════════════════════════════════════════

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
begin
  select g.tenant_id, g.program_id, g.name
    into v_tenant, v_program, v_group_name
  from public.groups g
  where g.id = p_group_id;

  if v_tenant is null then
    return null;
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
      -- Bestaand event vandaag → no-op (geen herhaalde notify).
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

  -- ── Sprint 76e: notify in dezelfde transactie ────────────────
  -- Exception-tolerant: een mislukte notify mag de DELETE/UPDATE
  -- die ons hierheen riep nooit rollbacken.
  begin
    -- Resolve tenant_admin recipients (active members met user_id).
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

revoke all on function public.record_capacity_available_event(uuid, text, int) from public;
grant execute on function public.record_capacity_available_event(uuid, text, int) to authenticated;

comment on function public.record_capacity_available_event(uuid, text, int) is
  'Sprint 76e: registreert capacity_available_event én stuurt in '
  'dezelfde transactie een tenant_admin-notificatie (exception-tolerant). '
  'Day-dedup voorkomt herhaalde notify per (tenant,group,dag).';

-- Einde sprint76e_trigger_notify.sql
