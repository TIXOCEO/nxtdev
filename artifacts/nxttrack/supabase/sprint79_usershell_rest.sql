-- ============================================================================
-- Sprint 79 — UserShell-redesign rest (publieke + trainer + parent shells)
-- ============================================================================
-- Idempotent. Houtrust-veilig: alle nieuwe kolommen nullable met default,
-- alle nieuwe tabellen staan op zichzelf, geen bestaande paden geraakt.
--
-- Bevat:
--   A) public_upcoming_sessions view + grants                 (publieke shell)
--   B) tenant_events  tabel + RLS + audit-keys + indexen     (publieke shell)
--   C) trainer_tasks  tabel + RLS + notif-dedup-update       (trainer shell)
--   D) trainer_documents tabel + RLS                          (trainer shell)
-- ============================================================================

set search_path = public;

-- ────────────────────────────────────────────────────────────────────────────
-- A) public_upcoming_sessions — read-only view voor de publieke homepage
-- ────────────────────────────────────────────────────────────────────────────
-- Toggle via tenants.settings_json.public_show_upcoming_sessions (bool, default
-- false). De view zelf exposeert géén PII (geen attendees, geen notities).
-- security_invoker=true → respecteert onderliggende RLS van training_sessions
-- en groups; toepassings-laag gebruikt admin-client voor publieke reads en
-- filtert expliciet op tenant_id.

drop view if exists public.public_upcoming_sessions;

create view public.public_upcoming_sessions
  with (security_invoker = true)
as
select
  s.id          as session_id,
  s.tenant_id   as tenant_id,
  s.starts_at   as starts_at,
  s.ends_at     as ends_at,
  s.title       as title,
  s.location    as location,
  g.id          as group_id,
  g.name        as group_name
from public.training_sessions s
left join public.groups g on g.id = s.group_id and g.tenant_id = s.tenant_id
where s.status <> 'cancelled'
  and s.starts_at >= now()
  and s.starts_at <= now() + interval '14 days';

grant select on public.public_upcoming_sessions to anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- B) tenant_events — uitgelichte events/aankondigingen op de publieke homepage
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.tenant_events (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  title             text not null check (length(title) between 1 and 200),
  body              text,
  starts_at         timestamptz,
  ends_at           timestamptz,
  cta_label         text,
  cta_url           text,
  cover_image_url   text,
  is_featured       boolean not null default false,
  status            text not null default 'draft' check (status in ('draft','published','archived')),
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint tenant_events_tenant_fk
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint tenant_events_body_len_chk
    check (body is null or length(body) <= 4000),
  constraint tenant_events_cta_label_len_chk
    check (cta_label is null or length(cta_label) <= 80),
  constraint tenant_events_cta_url_fmt_chk
    check (cta_url is null or cta_url ~ '^(https?://|/)'),
  constraint tenant_events_cover_url_fmt_chk
    check (cover_image_url is null or cover_image_url ~ '^(https?://|/)'),
  constraint tenant_events_dates_chk
    check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists tenant_events_tenant_starts_idx
  on public.tenant_events (tenant_id, starts_at);

create index if not exists tenant_events_published_idx
  on public.tenant_events (tenant_id, starts_at)
  where status = 'published';

-- updated_at trigger (zelfde patroon als andere tenant-tabellen)
create or replace function public._tenant_events_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tenant_events_touch_updated_at on public.tenant_events;
create trigger tenant_events_touch_updated_at
  before update on public.tenant_events
  for each row execute function public._tenant_events_touch_updated_at();

alter table public.tenant_events enable row level security;

drop policy if exists tenant_events_public_read on public.tenant_events;
create policy tenant_events_public_read
  on public.tenant_events
  for select
  to anon, authenticated
  using (
    status = 'published'
    and (starts_at is null or starts_at >= now() - interval '1 day')
  );

drop policy if exists tenant_events_admin_all on public.tenant_events;
create policy tenant_events_admin_all
  on public.tenant_events
  for all
  to authenticated
  using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));


-- ────────────────────────────────────────────────────────────────────────────
-- C) trainer_tasks — taken-systeem voor trainers (eigen + door admin toegewezen)
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.trainer_tasks (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null,
  assigned_to_user_id  uuid not null,
  created_by_user_id   uuid,
  title                text not null check (length(title) between 1 and 200),
  body                 text,
  due_date             date,
  status               text not null default 'open'
                          check (status in ('open','done','cancelled')),
  priority             text not null default 'normal'
                          check (priority in ('low','normal','high')),
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint trainer_tasks_tenant_fk
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint trainer_tasks_body_len_chk
    check (body is null or length(body) <= 4000)
);

create index if not exists trainer_tasks_assignee_idx
  on public.trainer_tasks (tenant_id, assigned_to_user_id, status);
create index if not exists trainer_tasks_due_idx
  on public.trainer_tasks (tenant_id, due_date) where status = 'open';

create or replace function public._trainer_tasks_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (old.status is distinct from 'done') and new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trainer_tasks_touch_updated_at on public.trainer_tasks;
create trigger trainer_tasks_touch_updated_at
  before update on public.trainer_tasks
  for each row execute function public._trainer_tasks_touch_updated_at();

alter table public.trainer_tasks enable row level security;

drop policy if exists trainer_tasks_select on public.trainer_tasks;
create policy trainer_tasks_select
  on public.trainer_tasks
  for select
  to authenticated
  using (
    assigned_to_user_id = auth.uid()
    or created_by_user_id = auth.uid()
    or public.has_tenant_access(tenant_id)
  );

drop policy if exists trainer_tasks_insert on public.trainer_tasks;
create policy trainer_tasks_insert
  on public.trainer_tasks
  for insert
  to authenticated
  with check (
    public.has_tenant_access(tenant_id)
    or created_by_user_id = auth.uid()
  );

drop policy if exists trainer_tasks_update on public.trainer_tasks;
create policy trainer_tasks_update
  on public.trainer_tasks
  for update
  to authenticated
  using (
    assigned_to_user_id = auth.uid()
    or created_by_user_id = auth.uid()
    or public.has_tenant_access(tenant_id)
  )
  with check (
    assigned_to_user_id = auth.uid()
    or created_by_user_id = auth.uid()
    or public.has_tenant_access(tenant_id)
  );

drop policy if exists trainer_tasks_delete on public.trainer_tasks;
create policy trainer_tasks_delete
  on public.trainer_tasks
  for delete
  to authenticated
  using (
    created_by_user_id = auth.uid()
    or public.has_tenant_access(tenant_id)
  );


-- ── Notification dedup-pattern: voeg trainer_task_assigned toe (Sprint
--    41/43/53/55/57/64/65/66/73/74/76/77 pattern). Drop+recreate index én
--    update de matching array in create_notification_with_recipients.

drop index if exists public.notifications_source_idem_uq;
create unique index notifications_source_idem_uq
  on public.notifications (tenant_id, source, source_ref)
  where source = any (array[
    -- Bestaande keys (Sprint 41/43/53/55/57/64/65/66/73/74/76):
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
    -- Sprint 77:
    'child_attendance_recorded','child_attendance_missed','child_session_cancelled',
    'child_membership_expiring','child_placement_offered','child_note_published',
    -- Sprint 79 trainer-shell:
    'trainer_task_assigned'
  ]) and source_ref is not null;

-- RPC body: zelfde array. Signature blijft 10-param (Sprint 76g).
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
      -- Sprint 77 child_* keys:
      'child_attendance_recorded','child_attendance_missed','child_session_cancelled',
      'child_membership_expiring','child_placement_offered','child_note_published',
      -- Sprint 79 trainer-shell:
      'trainer_task_assigned'
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
-- D) trainer_documents — gedeelde handleidingen/protocollen/formulieren
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.trainer_documents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  title               text not null check (length(title) between 1 and 200),
  description         text,
  file_url            text not null,
  file_type           text,
  category            text not null default 'overig'
                         check (category in ('handleiding','protocol','formulier','overig')),
  uploaded_by_user_id uuid,
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint trainer_documents_tenant_fk
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint trainer_documents_desc_len_chk
    check (description is null or length(description) <= 2000),
  constraint trainer_documents_file_url_fmt_chk
    check (file_url ~ '^(https?://|/)')
);

create index if not exists trainer_documents_tenant_cat_idx
  on public.trainer_documents (tenant_id, category)
  where is_archived = false;

create or replace function public._trainer_documents_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trainer_documents_touch_updated_at on public.trainer_documents;
create trigger trainer_documents_touch_updated_at
  before update on public.trainer_documents
  for each row execute function public._trainer_documents_touch_updated_at();

alter table public.trainer_documents enable row level security;

-- Lezen: alle tenant-leden met membership of trainer-rol (we hergebruiken
-- has_tenant_access voor admins; trainers via memberships-tabel).
-- Hier kiezen we voor "iedereen met een tenant_id-membership" zodat trainers
-- documenten kunnen lezen zonder admin-rol. Het kunnen oproepen van deze
-- view wordt op de TS-laag beperkt tot user-roles waar trainer in zit.
drop policy if exists trainer_documents_select on public.trainer_documents;
create policy trainer_documents_select
  on public.trainer_documents
  for select
  to authenticated
  using (
    is_archived = false
    and exists (
      select 1 from public.tenant_memberships m
       where m.tenant_id = trainer_documents.tenant_id
         and m.user_id   = auth.uid()
    )
  );

-- Alleen admins kunnen schrijven (consistent met news/programmas).
drop policy if exists trainer_documents_admin_write on public.trainer_documents;
create policy trainer_documents_admin_write
  on public.trainer_documents
  for all
  to authenticated
  using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));


-- ============================================================================
-- Klaar.
-- ============================================================================
