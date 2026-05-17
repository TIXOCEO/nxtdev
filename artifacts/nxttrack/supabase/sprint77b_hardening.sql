-- ============================================================================
-- Sprint 77b — hardening na code-review (architect):
--   1) create_notification_with_recipients: expliciete revoke/grant
--   2) Dedup predicate drift fix: function-body array == index where-predicate
--   3) _compute_move_conflicts: revoke execute from public (internal helper)
-- ============================================================================
-- Idempotent.
-- ============================================================================

set search_path = public;

-- 1) Align dedup predicate: function-body array MUST match the partial-index
--    where-clause exactly. We use the canonical set from the Sprint 77 index.
drop function if exists public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb, text);

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
as $function$
declare
  notif_id     uuid;
  is_dedupable boolean;
  recipient    jsonb;
  target       jsonb;
begin
  -- Canonical dedup-set — MUST stay identical to the where-predicate of
  -- notifications_source_idem_uq (see sprint77_planning_fundament.sql).
  is_dedupable :=
    p_source_ref is not null
    and coalesce(p_source, '') in (
      'training_created','training_reminder','group_assigned','news_published',
      'membership_assigned','invite_accepted','attendance_changed_late',
      'trainer_attendance_updated','waitlist_offer_sent','waitlist_offer_accepted',
      'waitlist_offer_declined','makeup_credit_granted','makeup_request_approved',
      'makeup_request_declined','milestone_event_invited','milestone_event_result_published',
      'certificate_issued','progress_milestone_reached','instructor_assignment_added',
      'instructor_assignment_removed','substitute_assigned','waitlist_entry_program_assigned',
      'intake_submission_created','intake_submission_needs_review',
      'intake_submission_auto_waitlisted','intake_slot_offered','intake_slot_accepted',
      'intake_slot_declined','capacity_available_candidates',
      'child_attendance_recorded','child_attendance_missed','child_session_cancelled',
      'child_membership_expiring','child_placement_offered','child_note_published'
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
        null;
      end;
    end loop;
  end if;

  return notif_id;
end
$function$;

-- 1b) Explicit lockdown (sprint76f-pattern).
revoke all on function public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb, text) from public;
revoke all on function public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb, text) from anon;
revoke all on function public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb, text) from authenticated;
-- Server-side callers gebruiken de admin (service_role) client — die mag execute.
grant execute on function public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb, text) to service_role;

-- 3) Internal helper — geen broad execute. preview_move_session en
--    move_session zijn security-definer en roepen deze intern aan; daar is
--    geen grant aan authenticated/anon voor nodig.
revoke all on function public._compute_move_conflicts(uuid, timestamptz, timestamptz) from public;
revoke all on function public._compute_move_conflicts(uuid, timestamptz, timestamptz) from anon;
revoke all on function public._compute_move_conflicts(uuid, timestamptz, timestamptz) from authenticated;
-- service_role kan deze nog steeds aanroepen voor diagnostiek.
grant execute on function public._compute_move_conflicts(uuid, timestamptz, timestamptz) to service_role;
