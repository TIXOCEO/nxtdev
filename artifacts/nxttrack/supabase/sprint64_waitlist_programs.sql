-- ─────────────────────────────────────────────────────────────────────
-- Sprint 64 — Waitlist program-koppeling + intake-overrides (v0.20.0).
--
-- Doel: wachtlijst-aanvragen kunnen worden gekoppeld aan een program
-- (`waitlists.program_id`, `waitlist_entries.program_id`). De
-- intake-routing-cascade (`intake_default` → `intake_overrides_by_target`
-- → `intake_overrides_by_program`) wordt op app-niveau toegevoegd; deze
-- migratie levert alleen het schema-fundament + notification-dedup-key
-- `waitlist_entry_program_assigned` (drop+recreate-patroon, conform
-- Sprint 41/43/53/55/57-Gotcha — predicate identiek gespiegeld in
-- create_notification_with_recipients-`on conflict where`-clause).
--
-- Idempotent: alle DDL is `if not exists` / `drop if exists` →
-- veilig herbruikbaar op dev en prod.
-- ─────────────────────────────────────────────────────────────────────

-- 1. waitlists.program_id (composite FK + index).
alter table public.waitlists
  add column if not exists program_id uuid;

alter table public.waitlists
  drop constraint if exists waitlists_program_tenant_fk;
alter table public.waitlists
  add constraint waitlists_program_tenant_fk
  foreign key (program_id, tenant_id)
  references public.programs (id, tenant_id)
  on delete set null;

create index if not exists waitlists_program_idx
  on public.waitlists (tenant_id, program_id)
  where program_id is not null;

-- 2. waitlist_entries.program_id (composite FK + index).
alter table public.waitlist_entries
  add column if not exists program_id uuid;

alter table public.waitlist_entries
  drop constraint if exists waitlist_entries_program_tenant_fk;
alter table public.waitlist_entries
  add constraint waitlist_entries_program_tenant_fk
  foreign key (program_id, tenant_id)
  references public.programs (id, tenant_id)
  on delete set null;

create index if not exists waitlist_entries_program_idx
  on public.waitlist_entries (tenant_id, program_id, status, created_at desc)
  where program_id is not null;

-- 3. Notification dedup-index drop+recreate met nieuwe key
--    `waitlist_entry_program_assigned`. Predicate moet identiek zijn aan
--    de `on conflict where`-clause in de RPC verderop.
drop index if exists public.notifications_source_idem_uq;

create unique index notifications_source_idem_uq
  on public.notifications (tenant_id, source, source_ref)
  where source in (
          'training_created',
          'training_reminder',
          'group_assigned',
          'news_published',
          'membership_assigned',
          'invite_accepted',
          'attendance_changed_late',
          'trainer_attendance_updated',
          'waitlist_offer_sent',
          'waitlist_offer_accepted',
          'waitlist_offer_declined',
          'makeup_credit_granted',
          'makeup_request_approved',
          'makeup_request_declined',
          'milestone_event_invited',
          'milestone_event_result_published',
          'certificate_issued',
          'progress_milestone_reached',
          'instructor_assignment_added',
          'instructor_assignment_removed',
          'substitute_assigned',
          'waitlist_entry_program_assigned'
        )
    and source_ref is not null;

-- 4. RPC create_notification_with_recipients — body is identiek aan
--    Sprint 57, alleen de twee `in (…)`-lijsten zijn uitgebreid met de
--    nieuwe key. `or replace` houdt de signature stabiel.
create or replace function public.create_notification_with_recipients(
  p_tenant_id     uuid,
  p_title         text,
  p_content_html  text,
  p_content_text  text,
  p_source        text,
  p_source_ref    uuid,
  p_created_by    uuid,
  p_targets       jsonb,
  p_recipients    jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notif_id     uuid;
  is_dedupable boolean;
  recipient    jsonb;
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
      'instructor_assignment_added','instructor_assignment_removed','substitute_assigned',
      'waitlist_entry_program_assigned'
    );

  if is_dedupable then
    select id into notif_id
      from public.notifications
     where tenant_id = p_tenant_id
       and source    = p_source
       and source_ref = p_source_ref
     limit 1;
    if notif_id is not null then
      return notif_id;
    end if;
  end if;

  insert into public.notifications
    (tenant_id, title, content_html, content_text, source, source_ref, created_by)
  values
    (p_tenant_id, p_title, p_content_html, p_content_text, p_source, p_source_ref, p_created_by)
  on conflict (tenant_id, source, source_ref)
    where source in (
            'training_created','training_reminder','group_assigned',
            'news_published','membership_assigned','invite_accepted',
            'attendance_changed_late','trainer_attendance_updated',
            'waitlist_offer_sent','waitlist_offer_accepted','waitlist_offer_declined',
            'makeup_credit_granted','makeup_request_approved','makeup_request_declined',
            'milestone_event_invited','milestone_event_result_published','certificate_issued',
            'progress_milestone_reached',
            'instructor_assignment_added','instructor_assignment_removed','substitute_assigned',
            'waitlist_entry_program_assigned'
          )
      and source_ref is not null
    do nothing
  returning id into notif_id;

  if notif_id is null and is_dedupable then
    select id into notif_id
      from public.notifications
     where tenant_id = p_tenant_id
       and source    = p_source
       and source_ref = p_source_ref
     limit 1;
  end if;

  if notif_id is null then
    raise exception 'create_notification_with_recipients: insert returned no id';
  end if;

  for recipient in select * from jsonb_array_elements(coalesce(p_recipients, '[]'::jsonb)) loop
    insert into public.notification_recipients (notification_id, user_id)
    values (notif_id, (recipient->>'user_id')::uuid)
    on conflict (notification_id, user_id) do nothing;
  end loop;

  for recipient in select * from jsonb_array_elements(coalesce(p_targets, '[]'::jsonb)) loop
    insert into public.notification_targets (notification_id, target_kind, target_id)
    values (notif_id,
            recipient->>'target_kind',
            nullif(recipient->>'target_id','')::uuid)
    on conflict do nothing;
  end loop;

  return notif_id;
end;
$$;

-- Einde sprint64_waitlist_programs.sql.
