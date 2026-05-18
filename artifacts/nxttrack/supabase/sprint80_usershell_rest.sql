-- ============================================================================
-- Sprint 80 — UserShell-redesign voltooien (trainer + parent UI-fundament)
-- ============================================================================
-- Idempotent. Houtrust-veilig:
--   - nieuwe kolom training_attendance.skill_level (nullable, default null)
--   - nieuwe tabel child_diplomas (leeg + RLS)
--   - notif-dedup-pattern update voor child_diploma_awarded
--   - tenant_modules size-check refresh (defensief, blijft op huidige set)
-- ============================================================================

set search_path = public;

-- ────────────────────────────────────────────────────────────────────────────
-- A) training_attendance.skill_level — 5-niveau skill-grid voor Beoordelen
-- ────────────────────────────────────────────────────────────────────────────
-- Generieke labels; sector-templates mappen later eigen labels.

alter table public.training_attendance
  add column if not exists skill_level text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'training_attendance_skill_level_chk'
  ) then
    alter table public.training_attendance
      add constraint training_attendance_skill_level_chk
      check (skill_level is null
             or skill_level in ('none','practice','almost','good','mastered'));
  end if;
end$$;

-- ────────────────────────────────────────────────────────────────────────────
-- B) child_diplomas — behaalde diploma's per (lid/kind)
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.child_diplomas (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null,
  member_id               uuid not null,
  diploma_name            text not null check (length(diploma_name) between 1 and 120),
  level                   text,
  awarded_on              date not null default current_date,
  awarded_by_member_id    uuid,
  certificate_url         text,
  photo_url               text,
  notes                   text,
  created_by_user_id      uuid,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint child_diplomas_tenant_fk
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint child_diplomas_level_len_chk
    check (level is null or length(level) <= 40),
  constraint child_diplomas_notes_len_chk
    check (notes is null or length(notes) <= 1000),
  constraint child_diplomas_certificate_url_fmt_chk
    check (certificate_url is null or certificate_url ~ '^(https?://|/)'),
  constraint child_diplomas_photo_url_fmt_chk
    check (photo_url is null or photo_url ~ '^(https?://|/)'),
  -- Composite-FK pattern (Sprint 60+): (member_id, tenant_id) → members
  constraint child_diplomas_member_fk
    foreign key (member_id, tenant_id)
    references public.members (id, tenant_id) on delete cascade
);

create index if not exists child_diplomas_member_awarded_idx
  on public.child_diplomas (member_id, awarded_on desc);

create index if not exists child_diplomas_tenant_awarded_idx
  on public.child_diplomas (tenant_id, awarded_on desc);

-- updated_at trigger
create or replace function public._child_diplomas_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists child_diplomas_touch_updated_at on public.child_diplomas;
create trigger child_diplomas_touch_updated_at
  before update on public.child_diplomas
  for each row execute function public._child_diplomas_touch_updated_at();

alter table public.child_diplomas enable row level security;

-- RLS: lezen
--  1) admins (has_tenant_access)
--  2) member-self (members.user_id = auth.uid())
--  3) parent via member_links (eigen kinderen)
--  4) staff/trainers met tenant_membership (read-only — voor Leerling-detail)
drop policy if exists child_diplomas_select on public.child_diplomas;
create policy child_diplomas_select
  on public.child_diplomas
  for select
  to authenticated
  using (
    public.has_tenant_access(tenant_id)
    or exists (
      select 1 from public.members m
       where m.id = child_diplomas.member_id
         and m.tenant_id = child_diplomas.tenant_id
         and m.user_id = auth.uid()
    )
    or exists (
      select 1
        from public.member_links ml
        join public.members pm
          on pm.id = ml.parent_member_id
         and pm.tenant_id = ml.tenant_id
       where ml.tenant_id = child_diplomas.tenant_id
         and ml.child_member_id = child_diplomas.member_id
         and pm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.tenant_memberships tm
       where tm.tenant_id = child_diplomas.tenant_id
         and tm.user_id = auth.uid()
    )
  );

-- RLS: schrijven — alleen admin
drop policy if exists child_diplomas_admin_write on public.child_diplomas;
create policy child_diplomas_admin_write
  on public.child_diplomas
  for all
  to authenticated
  using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));


-- ────────────────────────────────────────────────────────────────────────────
-- C) Notification dedup-pattern: voeg child_diploma_awarded toe
-- ────────────────────────────────────────────────────────────────────────────
-- Volgt Sprint 41/43/53/55/57/64/65/66/73/74/76/77/79 patroon:
-- drop+recreate index én update array in create_notification_with_recipients.

drop index if exists public.notifications_source_idem_uq;
create unique index notifications_source_idem_uq
  on public.notifications (tenant_id, source, source_ref)
  where source = any (array[
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
    'child_membership_expiring','child_placement_offered','child_note_published',
    'trainer_task_assigned',
    -- Sprint 80:
    'child_diploma_awarded'
  ]) and source_ref is not null;

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
      'capacity_available_candidates',
      'child_attendance_recorded','child_attendance_missed','child_session_cancelled',
      'child_membership_expiring','child_placement_offered','child_note_published',
      'trainer_task_assigned',
      'child_diploma_awarded'
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


-- ────────────────────────────────────────────────────────────────────────────
-- D) tenant_modules size-check refresh (defensief)
-- ────────────────────────────────────────────────────────────────────────────
-- Idempotent re-create om zeker te weten dat alle 4 formaten zijn toegestaan
-- (Sprint H homepage modules fixed-height — voorkomt 23-violation bij CMS).

alter table public.tenant_modules
  drop constraint if exists tenant_modules_size_check;

alter table public.tenant_modules
  add constraint tenant_modules_size_check
  check (size in ('1x1','1x2','2x1','2x2'));


-- ============================================================================
-- Klaar.
-- ============================================================================
