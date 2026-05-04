-- ──────────────────────────────────────────────────────────
-- Sprint 13 — PWA + push + attendance reasons.
--
--   1. Attendance reasons (extend training_attendance).
--   2. Push subscriptions (per-user, per-device).
--   3. Tenant push settings.
--   4. Platform push settings (singleton; VAPID).
--
-- All tenant-scoped tables use has_tenant_access() RLS.
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════
-- 1. Attendance reasons
-- ═════════════════════════════════════════════════════════
alter table public.training_attendance
  add column if not exists absence_reason   text,
  add column if not exists attendance_reason text,
  add column if not exists trainer_note     text;

-- Free-text fields are validated app-side (enum + length). No DB check
-- to keep migrations safe across forward-compatible enum additions.

-- ═════════════════════════════════════════════════════════
-- 2. Push subscriptions
-- ═════════════════════════════════════════════════════════
create table if not exists public.push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  endpoint    text        not null,
  p256dh      text        not null,
  auth        text        not null,
  user_agent  text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id) where is_active;
create index if not exists push_subscriptions_tenant_idx
  on public.push_subscriptions (tenant_id) where is_active;

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.handle_updated_at();

-- ═════════════════════════════════════════════════════════
-- 3. Tenant push settings
-- ═════════════════════════════════════════════════════════
create table if not exists public.tenant_push_settings (
  id                          uuid        primary key default gen_random_uuid(),
  tenant_id                   uuid        not null unique references public.tenants(id) on delete cascade,
  push_enabled                boolean     not null default true,
  -- jsonb map { event_key: bool }; missing keys → enabled by default.
  event_overrides             jsonb       not null default '{}'::jsonb,
  default_push_on_manual      boolean     not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

drop trigger if exists tenant_push_settings_updated_at on public.tenant_push_settings;
create trigger tenant_push_settings_updated_at
  before update on public.tenant_push_settings
  for each row execute function public.handle_updated_at();

-- ═════════════════════════════════════════════════════════
-- 4. Platform push settings (singleton)
-- ═════════════════════════════════════════════════════════
create table if not exists public.platform_push_settings (
  id                  uuid        primary key default gen_random_uuid(),
  singleton           boolean     not null default true unique
                      check (singleton = true),
  vapid_public_key    text,
  vapid_private_key   text,
  vapid_subject       text        not null default 'mailto:admin@nxttrack.nl',
  -- platform-allowed event types (whitelist). Empty array = ALL allowed.
  allowed_event_keys  text[]      not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists platform_push_settings_updated_at on public.platform_push_settings;
create trigger platform_push_settings_updated_at
  before update on public.platform_push_settings
  for each row execute function public.handle_updated_at();

-- ═════════════════════════════════════════════════════════
-- RLS
-- ═════════════════════════════════════════════════════════
alter table public.push_subscriptions       enable row level security;
alter table public.tenant_push_settings     enable row level security;
alter table public.platform_push_settings   enable row level security;

-- push_subscriptions ----------------------------------------------
drop policy if exists "push_subs_tenant_all"  on public.push_subscriptions;
drop policy if exists "push_subs_self_all"    on public.push_subscriptions;

-- Tenant admins manage subs in their tenant.
create policy "push_subs_tenant_all" on public.push_subscriptions
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Owner can read/insert/update/delete own subs.
create policy "push_subs_self_all" on public.push_subscriptions
  for all using (user_id = auth.uid())
          with check (user_id = auth.uid());

-- tenant_push_settings -------------------------------------------
drop policy if exists "tps_tenant_all"  on public.tenant_push_settings;
drop policy if exists "tps_member_read" on public.tenant_push_settings;

create policy "tps_tenant_all" on public.tenant_push_settings
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Any authenticated user with a member row in this tenant can read settings
-- (the public push UI needs to know if push is globally enabled).
create policy "tps_member_read" on public.tenant_push_settings
  for select using (
    exists (
      select 1 from public.members m
      where m.tenant_id = tenant_push_settings.tenant_id
        and m.user_id = auth.uid()
    )
  );

-- platform_push_settings -----------------------------------------
drop policy if exists "pps_platform_all"  on public.platform_push_settings;
drop policy if exists "pps_authed_read"   on public.platform_push_settings;

create policy "pps_platform_all" on public.platform_push_settings
  for all using (public.is_platform_admin())
          with check (public.is_platform_admin());

-- Anyone authenticated may read (the VAPID public key is needed
-- in browser to subscribe; it is a public credential by design).
create policy "pps_authed_read" on public.platform_push_settings
  for select using (auth.uid() is not null);
