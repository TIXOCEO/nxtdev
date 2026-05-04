-- ──────────────────────────────────────────────────────────
-- Sprint 12 — Operational sports layer.
--
--   1. Atomic notification RPC (replaces sequential writes).
--   2. Training schedule + attendance.
--   3. Per-tenant training settings.
--   4. Profile-picture template system (platform + tenant + member).
--   5. Optional notification_events column extras.
--
-- All tenant-scoped tables use has_tenant_access() RLS.
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════
-- 1. Atomic notification RPC
-- ═════════════════════════════════════════════════════════
-- Single transaction: notification + targets + recipients.
-- Caller MUST have already asserted tenant access. We run as
-- service role via SECURITY DEFINER so we don't depend on RLS.
create or replace function public.create_notification_with_recipients(
  p_tenant_id     uuid,
  p_title         text,
  p_content_html  text,
  p_content_text  text,
  p_source        text,
  p_source_ref    uuid,
  p_created_by    uuid,
  p_targets       jsonb,   -- [{target_type, target_id?}]
  p_recipients    jsonb    -- [{member_id?, user_id}]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notif_id uuid;
begin
  insert into public.notifications (
    tenant_id, title, content_html, content_text,
    source, source_ref, created_by, email_sent
  )
  values (
    p_tenant_id, p_title, p_content_html, p_content_text,
    coalesce(p_source, 'manual'), p_source_ref, p_created_by, false
  )
  returning id into notif_id;

  if p_targets is not null and jsonb_array_length(p_targets) > 0 then
    insert into public.notification_targets (notification_id, target_type, target_id)
    select
      notif_id,
      (t->>'target_type')::text,
      case when (t->>'target_type') = 'all' then null else (t->>'target_id')::text end
    from jsonb_array_elements(p_targets) as t;
  end if;

  if p_recipients is not null and jsonb_array_length(p_recipients) > 0 then
    insert into public.notification_recipients
      (notification_id, tenant_id, member_id, user_id, is_read)
    select
      notif_id,
      p_tenant_id,
      nullif(r->>'member_id','')::uuid,
      (r->>'user_id')::uuid,
      false
    from jsonb_array_elements(p_recipients) as r
    on conflict (notification_id, user_id) do nothing;
  end if;

  return notif_id;
end;
$$;

revoke all on function public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb
) from public;
grant execute on function public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb
) to service_role;

-- ═════════════════════════════════════════════════════════
-- 2. Training schedule
-- ═════════════════════════════════════════════════════════
create table if not exists public.training_sessions (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  group_id    uuid        not null references public.groups(id) on delete cascade,
  title       text        not null,
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  location    text,
  status      text        not null default 'scheduled'
              check (status in ('scheduled','cancelled','completed')),
  created_by  uuid        references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists training_sessions_tenant_starts_idx
  on public.training_sessions (tenant_id, starts_at desc);
create index if not exists training_sessions_group_starts_idx
  on public.training_sessions (group_id, starts_at desc);

drop trigger if exists training_sessions_updated_at on public.training_sessions;
create trigger training_sessions_updated_at
  before update on public.training_sessions
  for each row execute function public.handle_updated_at();

create table if not exists public.training_attendance (
  id                       uuid        primary key default gen_random_uuid(),
  tenant_id                uuid        not null references public.tenants(id) on delete cascade,
  session_id               uuid        not null references public.training_sessions(id) on delete cascade,
  member_id                uuid        not null references public.members(id) on delete cascade,
  -- Athlete/parent intent (RSVP)
  rsvp                     text        check (rsvp in ('attending','not_attending','maybe')),
  rsvp_at                  timestamptz,
  rsvp_by_user_id          uuid        references auth.users(id) on delete set null,
  rsvp_late                boolean     not null default false,
  -- Trainer mark
  attendance               text        check (attendance in ('present','absent','late','injured')),
  attendance_at            timestamptz,
  attendance_by_user_id    uuid        references auth.users(id) on delete set null,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (session_id, member_id)
);

create index if not exists training_attendance_session_idx
  on public.training_attendance (session_id);
create index if not exists training_attendance_member_idx
  on public.training_attendance (member_id);

drop trigger if exists training_attendance_updated_at on public.training_attendance;
create trigger training_attendance_updated_at
  before update on public.training_attendance
  for each row execute function public.handle_updated_at();

-- ═════════════════════════════════════════════════════════
-- 3. Tenant training settings
-- ═════════════════════════════════════════════════════════
create table if not exists public.tenant_training_settings (
  id                       uuid        primary key default gen_random_uuid(),
  tenant_id                uuid        not null unique references public.tenants(id) on delete cascade,
  reminder_hours_before    int         not null default 24,
  late_response_hours      int         not null default 12,
  notify_trainer_on_late   boolean     not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists tenant_training_settings_updated_at on public.tenant_training_settings;
create trigger tenant_training_settings_updated_at
  before update on public.tenant_training_settings
  for each row execute function public.handle_updated_at();

-- ═════════════════════════════════════════════════════════
-- 4. Profile picture templates
-- ═════════════════════════════════════════════════════════
-- tenant_id NULL → platform-default template, available to every tenant.
create table if not exists public.profile_picture_templates (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        references public.tenants(id) on delete cascade,
  name        text        not null,
  image_url   text        not null,
  created_by  uuid        references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists profile_picture_templates_tenant_idx
  on public.profile_picture_templates (tenant_id);

create table if not exists public.tenant_profile_picture_settings (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             uuid        not null unique references public.tenants(id) on delete cascade,
  default_template_id   uuid        references public.profile_picture_templates(id) on delete set null,
  allow_member_choose   boolean     not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists tenant_profile_picture_settings_updated_at on public.tenant_profile_picture_settings;
create trigger tenant_profile_picture_settings_updated_at
  before update on public.tenant_profile_picture_settings
  for each row execute function public.handle_updated_at();

create table if not exists public.member_profile_pictures (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  member_id   uuid        not null unique references public.members(id) on delete cascade,
  template_id uuid        references public.profile_picture_templates(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists member_profile_pictures_tenant_idx
  on public.member_profile_pictures (tenant_id);

drop trigger if exists member_profile_pictures_updated_at on public.member_profile_pictures;
create trigger member_profile_pictures_updated_at
  before update on public.member_profile_pictures
  for each row execute function public.handle_updated_at();

-- ═════════════════════════════════════════════════════════
-- RLS
-- ═════════════════════════════════════════════════════════
alter table public.training_sessions               enable row level security;
alter table public.training_attendance             enable row level security;
alter table public.tenant_training_settings        enable row level security;
alter table public.profile_picture_templates       enable row level security;
alter table public.tenant_profile_picture_settings enable row level security;
alter table public.member_profile_pictures         enable row level security;

-- training_sessions ---------------------------------------------------------
drop policy if exists "training_sessions_tenant_all"  on public.training_sessions;
drop policy if exists "training_sessions_member_read" on public.training_sessions;

create policy "training_sessions_tenant_all" on public.training_sessions
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Athletes/parents/trainers in the group can read its sessions.
create policy "training_sessions_member_read" on public.training_sessions
  for select using (
    exists (
      select 1
      from public.group_members gm
      join public.members m on m.id = gm.member_id
      where gm.group_id = training_sessions.group_id
        and m.tenant_id = training_sessions.tenant_id
        and (
          m.user_id = auth.uid()
          or exists (
            select 1 from public.member_links ml
            where ml.tenant_id = training_sessions.tenant_id
              and ml.child_member_id = m.id
              and exists (
                select 1 from public.members p
                where p.id = ml.parent_member_id
                  and p.user_id = auth.uid()
              )
          )
        )
    )
  );

-- training_attendance -------------------------------------------------------
drop policy if exists "training_attendance_tenant_all"  on public.training_attendance;
drop policy if exists "training_attendance_self_read"   on public.training_attendance;
drop policy if exists "training_attendance_self_update" on public.training_attendance;

create policy "training_attendance_tenant_all" on public.training_attendance
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

create policy "training_attendance_self_read" on public.training_attendance
  for select using (
    exists (
      select 1 from public.members m
      where m.id = training_attendance.member_id
        and m.tenant_id = training_attendance.tenant_id
        and (
          m.user_id = auth.uid()
          or exists (
            select 1 from public.member_links ml
            where ml.tenant_id = training_attendance.tenant_id
              and ml.child_member_id = m.id
              and exists (
                select 1 from public.members p
                where p.id = ml.parent_member_id
                  and p.user_id = auth.uid()
              )
          )
        )
    )
  );

-- tenant_training_settings --------------------------------------------------
drop policy if exists "tenant_training_settings_tenant_all" on public.tenant_training_settings;
create policy "tenant_training_settings_tenant_all" on public.tenant_training_settings
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- profile_picture_templates -------------------------------------------------
drop policy if exists "ppt_platform_all"      on public.profile_picture_templates;
drop policy if exists "ppt_tenant_read"       on public.profile_picture_templates;
drop policy if exists "ppt_tenant_write_own"  on public.profile_picture_templates;
drop policy if exists "ppt_authenticated_read" on public.profile_picture_templates;

-- Platform admins can manage everything (including platform-defaults).
create policy "ppt_platform_all" on public.profile_picture_templates
  for all using (public.is_platform_admin())
          with check (public.is_platform_admin());

-- Any authenticated user can read platform defaults + their tenant rows.
create policy "ppt_authenticated_read" on public.profile_picture_templates
  for select using (
    tenant_id is null or public.has_tenant_access(tenant_id)
  );

-- Tenant admins can write only their own tenant rows (not null/platform).
create policy "ppt_tenant_write_own" on public.profile_picture_templates
  for all using (tenant_id is not null and public.has_tenant_access(tenant_id))
          with check (tenant_id is not null and public.has_tenant_access(tenant_id));

-- tenant_profile_picture_settings -------------------------------------------
drop policy if exists "tpps_tenant_all" on public.tenant_profile_picture_settings;
create policy "tpps_tenant_all" on public.tenant_profile_picture_settings
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- member_profile_pictures ---------------------------------------------------
drop policy if exists "mpp_tenant_all"  on public.member_profile_pictures;
drop policy if exists "mpp_self_read"   on public.member_profile_pictures;
drop policy if exists "mpp_self_update" on public.member_profile_pictures;

create policy "mpp_tenant_all" on public.member_profile_pictures
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Members can read + update their own picture.
create policy "mpp_self_read" on public.member_profile_pictures
  for select using (
    exists (
      select 1 from public.members m
      where m.id = member_profile_pictures.member_id
        and m.user_id = auth.uid()
    )
  );

create policy "mpp_self_update" on public.member_profile_pictures
  for update using (
    exists (
      select 1 from public.members m
      where m.id = member_profile_pictures.member_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = member_profile_pictures.member_id
        and m.user_id = auth.uid()
    )
  );

-- ═════════════════════════════════════════════════════════
-- 5. New notification event keys (documentation only).
-- ═════════════════════════════════════════════════════════
-- These keys are read via getNotificationEvent(). When no row exists the
-- helper returns null, in which case the trigger fires with default settings.
-- Tenants can override per-key via the notifications settings UI.
--
-- New for Sprint 12:
--   * new_registration_submitted
--   * invite_accepted
--   * membership_assigned
--   * group_assigned
--   * training_created
--   * training_reminder
--   * attendance_changed_late
--   * trainer_attendance_updated
