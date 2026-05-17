-- ═════════════════════════════════════════════════════════════════
-- Sprint 74 — Auto-waitlist + slot-offer voor intake (v0.31.0).
--
-- 1. Nieuwe tabel `intake_slot_offers` voor token-based plek-aanbod
--    op intake_submissions. Composite-FK pattern (Sprint 60+) en
--    partial index op active (used_at is null + status=pending).
--    Tokens worden door de DB gegenereerd via gen_random_uuid().
--
-- 2. Drop+recreate van notifications_source_idem_uq + RPC met de
--    drie nieuwe dedup-keys (Sprint 41/43/53/55/57/64/65/66/73-
--    pattern):
--      - intake_slot_offered   source_ref = intake_slot_offers.id
--      - intake_slot_accepted  source_ref = intake_slot_offers.id
--      - intake_slot_declined  source_ref = intake_slot_offers.id
--
-- Idempotent — alle DDL is `if not exists` / `drop+recreate`.
-- ═════════════════════════════════════════════════════════════════

-- 1. intake_slot_offers ────────────────────────────────────────────
create table if not exists public.intake_slot_offers (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  submission_id uuid        not null,
  group_id      uuid        not null,
  session_id    uuid,
  token         uuid        not null default gen_random_uuid() unique,
  status        text        not null default 'pending'
                check (status in ('pending','accepted','declined','expired','cancelled')),
  expires_at    timestamptz not null,
  used_at       timestamptz,
  suggestion_rank   integer,
  suggestion_score  numeric,
  created_by    uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Composite-FK's tegen intake_submissions + groups (tenant-scope).
alter table public.intake_slot_offers
  drop constraint if exists intake_slot_offers_submission_tenant_fk;
alter table public.intake_slot_offers
  add constraint intake_slot_offers_submission_tenant_fk
  foreign key (submission_id, tenant_id)
  references public.intake_submissions (id, tenant_id)
  on delete cascade;

alter table public.intake_slot_offers
  drop constraint if exists intake_slot_offers_group_tenant_fk;
alter table public.intake_slot_offers
  add constraint intake_slot_offers_group_tenant_fk
  foreign key (group_id, tenant_id)
  references public.groups (id, tenant_id)
  on delete cascade;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'intake_slot_offers_id_tenant_uq'
  ) then
    alter table public.intake_slot_offers
      add constraint intake_slot_offers_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

-- Snelle lookup op token bij accept/decline (token is al uniek, maar
-- we filteren bij elke call OOK op used_at IS NULL).
create index if not exists intake_slot_offers_token_active_idx
  on public.intake_slot_offers (token)
  where used_at is null;

-- Tijdlijn op submission-detail page.
create index if not exists intake_slot_offers_submission_idx
  on public.intake_slot_offers (submission_id, created_at desc);

-- Optionele scan voor verlopen-cleanup-jobs in latere sprints.
create index if not exists intake_slot_offers_expiry_idx
  on public.intake_slot_offers (expires_at)
  where used_at is null and status = 'pending';

drop trigger if exists intake_slot_offers_updated_at on public.intake_slot_offers;
create trigger intake_slot_offers_updated_at
  before update on public.intake_slot_offers
  for each row execute function public.handle_updated_at();

alter table public.intake_slot_offers enable row level security;

drop policy if exists intake_slot_offers_tenant_access on public.intake_slot_offers;
create policy intake_slot_offers_tenant_access on public.intake_slot_offers
  for all to authenticated
  using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- 2. Notification dedup-pattern drop+recreate ─────────────────────
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
          'intake_submission_needs_review',
          'intake_submission_auto_waitlisted',
          'intake_slot_offered',
          'intake_slot_accepted',
          'intake_slot_declined'
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
      'intake_submission_needs_review',
      'intake_submission_auto_waitlisted',
      'intake_slot_offered',
      'intake_slot_accepted',
      'intake_slot_declined'
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
            'intake_submission_needs_review',
            'intake_submission_auto_waitlisted',
            'intake_slot_offered',
            'intake_slot_accepted',
            'intake_slot_declined'
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

-- Einde sprint74_intake_slot_offers.sql.
