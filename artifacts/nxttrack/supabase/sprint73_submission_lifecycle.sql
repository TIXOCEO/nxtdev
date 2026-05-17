-- ═════════════════════════════════════════════════════════════════
-- Sprint 73 — Submission lifecycle + needs_review notification.
--
-- 1. Vervang de status-check op `intake_submissions` met de nieuwe
--    lifecycle-set (submitted, in_review, needs_review, waitlisted,
--    placed, rejected, converted). Oude waarden (`reviewing`,
--    `eligible`, `cancelled`) komen niet meer voor — defensieve
--    UPDATE'jes mappen ze veilig (idempotent: no-op bij 0 rijen).
--
-- 2. Drop+recreate van `notifications_source_idem_uq` + RPC
--    `create_notification_with_recipients` met de nieuwe key
--    `intake_submission_needs_review` (Sprint 41/43/53/55/57/64/65/66
--    dedup-pattern). `source_ref` = `intake_submissions.id`.
--
-- Idempotent.
-- ═════════════════════════════════════════════════════════════════

-- 1. Status lifecycle ──────────────────────────────────────────────

-- Map eventuele oude waarden (no-op op lege tabellen).
update public.intake_submissions set status = 'in_review'  where status = 'reviewing';
update public.intake_submissions set status = 'submitted'  where status = 'eligible';
update public.intake_submissions set status = 'rejected'   where status = 'cancelled';

alter table public.intake_submissions
  drop constraint if exists intake_submissions_status_check;

alter table public.intake_submissions
  add constraint intake_submissions_status_check
  check (status in (
    'submitted',
    'in_review',
    'needs_review',
    'waitlisted',
    'placed',
    'rejected',
    'converted'
  ));

-- Partiële index voor de "Vereist beoordeling"-queue (kop-tile op
-- /tenant/intake).
create index if not exists intake_submissions_tenant_needs_review_idx
  on public.intake_submissions (tenant_id, created_at desc)
  where status = 'needs_review';

-- 2. Notification dedup-pattern ────────────────────────────────────

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
          'waitlist_entry_program_assigned',
          'intake_submission_created',
          'intake_submission_needs_review'
        )
    and source_ref is not null;

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
      'waitlist_entry_program_assigned',
      'intake_submission_created',
      'intake_submission_needs_review'
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
            'waitlist_entry_program_assigned',
            'intake_submission_created',
            'intake_submission_needs_review'
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

-- Einde sprint73_submission_lifecycle.sql.
