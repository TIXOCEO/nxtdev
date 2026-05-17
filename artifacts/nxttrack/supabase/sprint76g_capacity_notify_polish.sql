-- ═════════════════════════════════════════════════════════════════
-- Sprint 76g — Capacity-event notificatie: deeplink + drempel
--
-- Task #130 — "Stuur tenant-admins een notificatie wanneer er een
-- plek vrijkomt". Sprint 76e/76f had de in-app bell-notificatie al
-- gebouwd. Deze migratie maakt twee resterende stukken af:
--
--   1. Klik op de notificatie opent /tenant/intake/vrijgekomen-plekken
--      → we voegen `notifications.push_url` toe en breiden de RPC
--        `create_notification_with_recipients` uit met `p_push_url`.
--        De record-helper passeert het deeplink-pad incl. event-anchor.
--   2. Drempel per tenant via `tenants.settings_json ->>
--      'capacity_event_min_freed_seats'` (default 1). Wanneer een event
--      < drempel vrije plekken vrijmaakt, blijft het event-rij staan
--      (zodat de UI-tile blijft tellen) maar wordt geen notificatie
--      verstuurd.
--
-- Idempotent. Drop+create voor functies, `add column if not exists`
-- voor de kolom.
-- ═════════════════════════════════════════════════════════════════

-- ── 1. push_url kolom op notifications ───────────────────────────
alter table public.notifications
  add column if not exists push_url text;

comment on column public.notifications.push_url is
  'Sprint 76g: optionele deeplink die door de in-app bell + web-push '
  'als klik-target gebruikt wordt. Mag null zijn voor info-notificaties.';

-- ── 2. RPC create_notification_with_recipients(+p_push_url) ──────
-- We droppen de 9-arg variant en recreëren met een 10e param
-- (default null zodat oudere callers nog werken).
drop function if exists public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb
);

create or replace function public.create_notification_with_recipients(
  p_tenant_id     uuid,
  p_title         text,
  p_content_html  text,
  p_content_text  text,
  p_source        text,
  p_source_ref    uuid,
  p_created_by    uuid,
  p_targets       jsonb,
  p_recipients    jsonb,
  p_push_url      text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notif_id     uuid;
  is_dedupable boolean;
  recipient    jsonb;
  target       jsonb;
begin
  is_dedupable :=
    p_source_ref is not null
    and coalesce(p_source, '') in (
      'training_created','training_reminder','group_assigned',
      'news_published','membership_assigned','invite_accepted',
      'attendance_changed_late','trainer_attendance_updated',
      'waitlist_offer_sent','waitlist_offer_accepted','waitlist_offer_declined',
      'makeup_credit_granted','makeup_request_approved','makeup_request_declined',
      'milestone_event_invited','milestone_event_result_published','certificate_issued',
      'progress_milestone_reached',
      'intake_submission_received','intake_status_changed',
      'intake_slot_offered','intake_slot_accepted','intake_slot_declined',
      'capacity_available_candidates'
    );

  if is_dedupable then
    select id into notif_id
      from public.notifications
     where tenant_id = p_tenant_id
       and source = p_source
       and source_ref = p_source_ref
     limit 1;
    if notif_id is not null then
      return notif_id;
    end if;
  end if;

  insert into public.notifications (
    tenant_id, title, content_html, content_text,
    source, source_ref, push_url, created_by, email_sent
  ) values (
    p_tenant_id, p_title, p_content_html, p_content_text,
    coalesce(p_source, 'manual'), p_source_ref, p_push_url, p_created_by, false
  )
  returning id into notif_id;

  if notif_id is null then
    raise exception 'create_notification_with_recipients: insert returned no id';
  end if;

  if p_targets is not null and jsonb_array_length(p_targets) > 0 then
    for target in select * from jsonb_array_elements(p_targets) loop
      insert into public.notification_targets (notification_id, target_type, target_id)
      values (
        notif_id,
        target->>'target_type',
        nullif(target->>'target_id', '')
      );
    end loop;
  end if;

  if p_recipients is not null and jsonb_array_length(p_recipients) > 0 then
    for recipient in select * from jsonb_array_elements(p_recipients) loop
      begin
        insert into public.notification_recipients
          (notification_id, tenant_id, member_id, user_id)
        values (
          notif_id,
          p_tenant_id,
          nullif(recipient->>'member_id','')::uuid,
          (recipient->>'user_id')::uuid
        );
      exception when unique_violation then
        -- recipient bestond al voor deze notificatie, overslaan.
        null;
      end;
    end loop;
  end if;

  return notif_id;
end $$;

revoke all on function public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb, text
) from public;
grant execute on function public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb, text
) to service_role;

comment on function public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb, text
) is
  'Sprint 76g: notificatie + targets + recipients in één transactie. '
  'p_push_url is optioneel en wordt door de bell-feed gebruikt voor '
  'klik-navigatie. Dedup via (tenant_id, source, source_ref) voor een '
  'vaste lijst event-keys.';

-- ── 3. record_capacity_available_event: alleen event-insert ─────
--
-- Sprint 76g (task #130 review-fix): sprint76e/76f had recipient-
-- resolutie (members + member_roles → tenant_admin list) en notify
-- in deze SQL-functie zitten. Code-review eist dat dat via de
-- bestaande TS RBAC-helpers loopt en niet in SQL gedupliceerd wordt.
-- Daarom strippen we de notify-tak en de recipient-resolve volledig:
-- de functie schrijft alleen de event-rij + kandidaten-count.
--
-- Notify gebeurt vanuit TS: `notifyCapacityEventIfAny` haakt aan op
-- `removeMemberFromGroup` en `updateGroup` en gebruikt
-- `sendNotification` → `resolveRecipients` (de canonical TS RBAC-
-- helper) → RPC `create_notification_with_recipients`.
--
-- Tenant-drempel (`settings_json.capacity_event_min_freed_seats`)
-- wordt ook in TS afgehandeld omdat dat tegelijk de notify-keuze
-- bepaalt — geen waarde meer om in SQL te dupliceren.
--
-- Drift t.o.v. sprint76e/76f: directe SQL DML / import-scripts die
-- de trigger raken krijgen GEEN notify meer (alleen TS admin-flows
-- doen dat). Dit was de oorspronkelijke architectuur uit sprint76
-- en wordt door deze review opnieuw bevestigd.
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
  v_event_id    uuid;
  v_candidates  int;
  v_role        text;
begin
  select g.tenant_id, g.program_id
    into v_tenant, v_program
  from public.groups g
  where g.id = p_group_id;

  if v_tenant is null then
    return null;
  end if;

  -- Belt-and-braces authz (overgenomen uit sprint76f).
  v_role := current_setting('request.jwt.claim.role', true);
  if coalesce(v_role, '') <> 'service_role'
     and current_user <> 'postgres'
     and not public.has_tenant_access(v_tenant) then
    raise exception 'access denied to record capacity event for tenant %', v_tenant
      using errcode = '42501';
  end if;

  -- Tel kandidaten (waitlisted submissions + waiting entries met
  -- program-overlap of program-null één-zijde). Dit is GEEN
  -- RBAC-resolutie — alleen een aggregaat-count voor de event-rij.
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

  -- Insert event (day-dedup via unique index).
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
  end;

  return v_event_id;
end $$;

revoke execute on function public.record_capacity_available_event(uuid, text, int) from public;
revoke execute on function public.record_capacity_available_event(uuid, text, int) from authenticated;

comment on function public.record_capacity_available_event(uuid, text, int) is
  'Sprint 76g: registreert alleen de capacity_available_event-rij + '
  'kandidaten-count. Notify/recipient-resolve gebeurt in TS '
  '(notifyCapacityEventIfAny → sendNotification → resolveRecipients).';

-- Einde sprint76g_capacity_notify_polish.sql
