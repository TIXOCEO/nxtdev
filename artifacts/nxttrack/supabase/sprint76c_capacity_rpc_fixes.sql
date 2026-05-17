-- ═════════════════════════════════════════════════════════════════
-- Sprint 76c — Fixes voor sprint76b RPCs (review-fix-2).
--
-- 1. create_notification_with_recipients had 2 bugs:
--    a. target_id werd ge-cast naar uuid, maar de kolom is text
--       én sommige targets (role:tenant_admin) zijn geen uuid.
--    b. notification_recipients-insert miste tenant_id; de integrity-
--       trigger weigert rijen waar new.tenant_id != parent.tenant_id.
-- 2. find_waitlist_candidates_for verwees naar s.contact_birthdate;
--    de kolom heet contact_date_of_birth.
--
-- Idempotent. Drop+create.
-- ═════════════════════════════════════════════════════════════════

-- 1. create_notification_with_recipients ──────────────────────────
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
      'instructor_assignment_added','instructor_assignment_removed','substitute_assigned',
      'waitlist_entry_program_assigned',
      'intake_submission_created',
      'intake_submission_needs_review',
      'intake_submission_auto_waitlisted',
      'intake_slot_offered',
      'intake_slot_accepted',
      'intake_slot_declined',
      'capacity_available_candidates'
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
  returning id into notif_id;

  -- target_id is text (kan een uuid-string of een role-naam zoals
  -- 'tenant_admin' zijn). NIET casten naar uuid.
  for target in select * from jsonb_array_elements(coalesce(p_targets, '[]'::jsonb))
  loop
    insert into public.notification_targets
      (notification_id, target_type, target_id)
    values
      (notif_id,
       target->>'target_type',
       nullif(target->>'target_id',''));
  end loop;

  -- tenant_id MOET mee — de integrity-trigger op
  -- notification_recipients_integrity_trg vergelijkt tegen
  -- parent.notifications.tenant_id en weigert mismatch (incl. null).
  for recipient in select * from jsonb_array_elements(coalesce(p_recipients, '[]'::jsonb))
  loop
    insert into public.notification_recipients
      (notification_id, tenant_id, member_id, user_id)
    values
      (notif_id,
       p_tenant_id,
       nullif(recipient->>'member_id','')::uuid,
       (recipient->>'user_id')::uuid)
    on conflict do nothing;
  end loop;

  return notif_id;
end $$;

-- 2. find_waitlist_candidates_for — birthdate column fix ──────────
drop function if exists public.find_waitlist_candidates_for(uuid, int);

create or replace function public.find_waitlist_candidates_for(
  p_group_id uuid,
  p_limit    int default 10
) returns table(
  source_type     text,
  candidate_id    uuid,
  contact_name    text,
  contact_email   text,
  program_id      uuid,
  program_name    text,
  score           int,
  created_at      timestamptz,
  status          text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant        uuid;
  v_group_program uuid;
begin
  select g.tenant_id, g.program_id
    into v_tenant, v_group_program
  from public.groups g
  where g.id = p_group_id;

  if v_tenant is null then
    return;
  end if;

  if not public.has_tenant_access(v_tenant) then
    raise exception 'access denied for group %', p_group_id
      using errcode = '42501';
  end if;

  return query
  with combined as (
    select
      'intake_submission'::text                          as source_type,
      s.id                                               as candidate_id,
      coalesce(s.contact_name, '')                       as contact_name,
      s.contact_email                                    as contact_email,
      s.program_id                                       as program_id,
      coalesce(ps.name, '')                              as program_name,
      (
        case
          when v_group_program is not null and s.program_id = v_group_program then 50
          when v_group_program is null or s.program_id is null then 25
          else 0
        end
        +
        case
          when ps.age_min is null and ps.age_max is null then 0
          when s.contact_date_of_birth is null then 0
          when extract(year from age(s.contact_date_of_birth))
               between coalesce(ps.age_min, 0) and coalesce(ps.age_max, 150)
            then 25
          else 0
        end
      )::int                                             as score,
      s.created_at                                       as created_at,
      s.status                                           as status
    from public.intake_submissions s
    left join public.programs ps
           on ps.id = s.program_id and ps.tenant_id = v_tenant
    where s.tenant_id = v_tenant
      and s.status = 'waitlisted'
      and (
        v_group_program is null
        or s.program_id is null
        or s.program_id = v_group_program
      )

    union all

    select
      'waitlist_entry'::text                             as source_type,
      we.id                                              as candidate_id,
      coalesce(we.contact_name, '')                      as contact_name,
      we.contact_email                                   as contact_email,
      we.program_id                                      as program_id,
      coalesce(pw.name, '')                              as program_name,
      (
        case
          when v_group_program is not null and we.program_id = v_group_program then 50
          when v_group_program is null or we.program_id is null then 25
          else 0
        end
      )::int                                             as score,
      we.created_at                                      as created_at,
      we.status                                          as status
    from public.waitlist_entries we
    left join public.programs pw
           on pw.id = we.program_id and pw.tenant_id = v_tenant
    where we.tenant_id = v_tenant
      and we.status = 'waiting'
      and (
        v_group_program is null
        or we.program_id is null
        or we.program_id = v_group_program
      )
  )
  select * from combined
   order by score desc, created_at asc
   limit greatest(p_limit, 1);
end $$;

revoke all on function public.find_waitlist_candidates_for(uuid, int) from public;
grant execute on function public.find_waitlist_candidates_for(uuid, int) to authenticated;

-- Einde sprint76c_capacity_rpc_fixes.sql
