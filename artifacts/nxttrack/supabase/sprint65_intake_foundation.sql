-- ═════════════════════════════════════════════════════════════════
-- Sprint 65 — Dynamic intake foundation (MVP, v0.21.0).
--
-- Levert het generieke fundament voor het dynamische aanmeldsysteem
-- zoals beschreven in `docs/dynamic-intake-research.md` §4 + §16:
--   1. 4 nieuwe tabellen: intake_forms, intake_form_fields,
--      intake_submissions, submission_answers (composite-FK pattern
--      conform Sprint 60-64).
--   2. Kolom registrations.intake_submission_id (nullable, composite-FK)
--      voor de tryout-compat-shim.
--   3. RLS via has_tenant_access(tenant_id). Publieke select op
--      intake_forms/intake_form_fields alleen voor `status='published'`
--      (form-renderer haalt config op zonder auth).
--   4. Notification dedup-index/RPC drop+recreate
--      (Sprint 41/43/53/55/57/64-patroon) met nieuwe key
--      `intake_submission_created`; source_ref = intake_submissions.id.
--
-- Geen wijziging aan `tenants.settings_json` schema — het is reeds
-- JSONB en de nieuwe key `dynamic_intake_enabled` (default `false`) is
-- alleen config-laag (geen migratie nodig).
--
-- Idempotent: alle DDL is `if not exists` / `drop if exists` →
-- veilig herbruikbaar op dev en prod.
-- ═════════════════════════════════════════════════════════════════

-- 1. intake_forms
create table if not exists public.intake_forms (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  slug        text not null,
  name        text not null,
  description text,
  status      text not null default 'draft'
              check (status in ('draft','published','archived')),
  is_default  boolean not null default false,
  settings_json jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Composite-uniek voor child-FK's (Sprint 60-64-patroon). Drop+recreate
-- kan niet vanwege FK-afhankelijkheid; gebruik conditional add.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'intake_forms_id_tenant_uq'
  ) then
    alter table public.intake_forms
      add constraint intake_forms_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

-- Per-tenant slug-uniek.
create unique index if not exists intake_forms_tenant_slug_uq
  on public.intake_forms (tenant_id, slug);

-- Maximaal één default-form per tenant.
drop index if exists public.intake_forms_one_default_uq;
create unique index intake_forms_one_default_uq
  on public.intake_forms (tenant_id)
  where is_default = true;

create index if not exists intake_forms_tenant_status_idx
  on public.intake_forms (tenant_id, status);

-- 2. intake_form_fields
create table if not exists public.intake_form_fields (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  form_id      uuid not null,
  key          text not null,
  label        text not null,
  help_text    text,
  field_type   text not null
               check (field_type in (
                 'text','textarea','email','phone','date','number',
                 'select','multiselect','radio','checkbox','consent'
               )),
  is_required  boolean not null default false,
  options_json jsonb not null default '[]'::jsonb,
  validation_json jsonb not null default '{}'::jsonb,
  show_if_json jsonb,
  sort_order   integer not null default 0,
  pii_class    text not null default 'standard'
               check (pii_class in ('standard','sensitive')),
  canonical_target text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.intake_form_fields
  drop constraint if exists intake_form_fields_form_tenant_fk;
alter table public.intake_form_fields
  add constraint intake_form_fields_form_tenant_fk
  foreign key (form_id, tenant_id)
  references public.intake_forms (id, tenant_id)
  on delete cascade;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'intake_form_fields_id_tenant_uq'
  ) then
    alter table public.intake_form_fields
      add constraint intake_form_fields_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

create unique index if not exists intake_form_fields_form_key_uq
  on public.intake_form_fields (form_id, key);

create index if not exists intake_form_fields_form_sort_idx
  on public.intake_form_fields (form_id, sort_order);

-- 3. intake_submissions
create table if not exists public.intake_submissions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  form_id           uuid,
  program_id        uuid,
  submission_type   text not null default 'registration'
                    check (submission_type in (
                      'registration','trial_lesson','waitlist_request','information_request'
                    )),
  status            text not null default 'submitted'
                    check (status in (
                      'submitted','reviewing','eligible','placed','rejected','cancelled'
                    )),
  registration_target text
                    check (registration_target in ('self','child')),
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  contact_date_of_birth date,
  priority_date     timestamptz not null default now(),
  preferences_json  jsonb not null default '{}'::jsonb,
  capacity_snapshot_json jsonb,
  assigned_member_id uuid,
  assigned_group_id  uuid,
  compat_registration_id uuid,
  compat_waitlist_entry_id uuid,
  agreed_terms      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.intake_submissions
  drop constraint if exists intake_submissions_form_tenant_fk;
alter table public.intake_submissions
  add constraint intake_submissions_form_tenant_fk
  foreign key (form_id, tenant_id)
  references public.intake_forms (id, tenant_id)
  on delete set null;

alter table public.intake_submissions
  drop constraint if exists intake_submissions_program_tenant_fk;
alter table public.intake_submissions
  add constraint intake_submissions_program_tenant_fk
  foreign key (program_id, tenant_id)
  references public.programs (id, tenant_id)
  on delete set null;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'intake_submissions_id_tenant_uq'
  ) then
    alter table public.intake_submissions
      add constraint intake_submissions_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

create index if not exists intake_submissions_tenant_status_idx
  on public.intake_submissions (tenant_id, status, created_at desc);

create index if not exists intake_submissions_tenant_program_idx
  on public.intake_submissions (tenant_id, program_id, status)
  where program_id is not null;

create index if not exists intake_submissions_tenant_email_idx
  on public.intake_submissions (tenant_id, lower(contact_email));

create index if not exists intake_submissions_form_idx
  on public.intake_submissions (form_id)
  where form_id is not null;

create index if not exists intake_submissions_assigned_member_idx
  on public.intake_submissions (assigned_member_id)
  where assigned_member_id is not null;

-- 4. submission_answers
create table if not exists public.submission_answers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  submission_id uuid not null,
  field_id      uuid,
  field_key     text not null,
  value_text    text,
  value_number  numeric,
  value_date    date,
  value_bool    boolean,
  value_json    jsonb,
  created_at    timestamptz not null default now()
);

alter table public.submission_answers
  drop constraint if exists submission_answers_submission_tenant_fk;
alter table public.submission_answers
  add constraint submission_answers_submission_tenant_fk
  foreign key (submission_id, tenant_id)
  references public.intake_submissions (id, tenant_id)
  on delete cascade;

alter table public.submission_answers
  drop constraint if exists submission_answers_field_tenant_fk;
alter table public.submission_answers
  add constraint submission_answers_field_tenant_fk
  foreign key (field_id, tenant_id)
  references public.intake_form_fields (id, tenant_id)
  on delete set null;

create unique index if not exists submission_answers_submission_field_uq
  on public.submission_answers (submission_id, field_key);

create index if not exists submission_answers_submission_idx
  on public.submission_answers (submission_id);

-- 5. Compat-shim: registrations.intake_submission_id
alter table public.registrations
  add column if not exists intake_submission_id uuid;

alter table public.registrations
  drop constraint if exists registrations_intake_submission_fk;
alter table public.registrations
  add constraint registrations_intake_submission_fk
  foreign key (intake_submission_id, tenant_id)
  references public.intake_submissions (id, tenant_id)
  on delete set null;

create index if not exists registrations_intake_submission_idx
  on public.registrations (intake_submission_id)
  where intake_submission_id is not null;

-- 6. RLS
alter table public.intake_forms        enable row level security;
alter table public.intake_form_fields  enable row level security;
alter table public.intake_submissions  enable row level security;
alter table public.submission_answers  enable row level security;

-- Admins/staff: volledige toegang via has_tenant_access.
drop policy if exists intake_forms_tenant_access on public.intake_forms;
create policy intake_forms_tenant_access on public.intake_forms
  for all to authenticated
  using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

drop policy if exists intake_form_fields_tenant_access on public.intake_form_fields;
create policy intake_form_fields_tenant_access on public.intake_form_fields
  for all to authenticated
  using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

drop policy if exists intake_submissions_tenant_access on public.intake_submissions;
create policy intake_submissions_tenant_access on public.intake_submissions
  for all to authenticated
  using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

drop policy if exists submission_answers_tenant_access on public.submission_answers;
create policy submission_answers_tenant_access on public.submission_answers
  for all to authenticated
  using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- Publieke read voor renderer: alleen published forms + bijbehorende fields.
drop policy if exists intake_forms_public_read on public.intake_forms;
create policy intake_forms_public_read on public.intake_forms
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists intake_form_fields_public_read on public.intake_form_fields;
create policy intake_form_fields_public_read on public.intake_form_fields
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.intake_forms f
       where f.id = intake_form_fields.form_id
         and f.status = 'published'
    )
  );

-- Member self-read op eigen submissions: assigned_member_id matcht
-- een member die aan deze auth-user gekoppeld is (eigen profiel, of
-- via member_links als parent → child).
drop policy if exists intake_submissions_self_read on public.intake_submissions;
create policy intake_submissions_self_read on public.intake_submissions
  for select to authenticated
  using (
    assigned_member_id is not null
    and (
      exists (
        select 1 from public.members m
         where m.id = intake_submissions.assigned_member_id
           and m.tenant_id = intake_submissions.tenant_id
           and m.user_id = auth.uid()
      )
      or exists (
        select 1
          from public.member_links ml
          join public.members parent on parent.id = ml.parent_member_id
         where ml.child_member_id = intake_submissions.assigned_member_id
           and ml.tenant_id = intake_submissions.tenant_id
           and parent.user_id = auth.uid()
      )
    )
  );

-- 7. Notification dedup-index drop+recreate met nieuwe key
--    `intake_submission_created`. Predicate moet identiek zijn aan
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
          'waitlist_entry_program_assigned',
          'intake_submission_created'
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
      'intake_submission_created'
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
            'intake_submission_created'
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

-- Einde sprint65_intake_foundation.sql.
