-- ──────────────────────────────────────────────────────────
-- Sprint 9 — Email infrastructure foundation.
--
--   email_settings          (platform-level SMTP, single row)
--   email_templates         (tenant-level template store)
--   email_logs              (every send attempt, success or failure)
--   tenant_email_settings   (per-tenant invite/sender preferences)
--   email_triggers          (per-tenant event → template binding)
--
-- All tenant tables are scoped via tenant_id with RLS that grants
-- has_tenant_access() to tenant admins and full access to platform
-- admins. email_settings is platform-only.
--
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

-- ── platform SMTP settings ───────────────────────────────
create table if not exists public.email_settings (
  id          uuid primary key default gen_random_uuid(),
  host        text not null,
  port        int  not null,
  username    text not null,
  password    text not null,
  from_email  text not null,
  from_name   text not null,
  secure      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists email_settings_updated_at on public.email_settings;
create trigger email_settings_updated_at
  before update on public.email_settings
  for each row execute function public.handle_updated_at();

alter table public.email_settings enable row level security;

drop policy if exists "email_settings_platform_only" on public.email_settings;
create policy "email_settings_platform_only" on public.email_settings
  for all
  using      (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ── tenant email templates ───────────────────────────────
create table if not exists public.email_templates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  key           text not null,
  name          text not null,
  subject       text not null,
  content_html  text not null,
  content_text  text,
  is_enabled    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, key)
);

create index if not exists email_templates_tenant_idx
  on public.email_templates (tenant_id, name);

drop trigger if exists email_templates_updated_at on public.email_templates;
create trigger email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.handle_updated_at();

alter table public.email_templates enable row level security;

drop policy if exists "email_templates_tenant_all" on public.email_templates;
create policy "email_templates_tenant_all" on public.email_templates
  for all
  using      (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- ── email logs ───────────────────────────────────────────
create table if not exists public.email_logs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references public.tenants(id) on delete set null,
  template_key    text,
  recipient_email text,
  subject         text,
  status          text not null,
  error_message   text,
  trigger_source  text,
  sent_at         timestamptz not null default now()
);

create index if not exists email_logs_tenant_idx
  on public.email_logs (tenant_id, sent_at desc);
create index if not exists email_logs_status_idx
  on public.email_logs (status, sent_at desc);

alter table public.email_logs enable row level security;

-- Tenant admins see only their tenant's logs; platform admin sees all
-- including null-tenant rows (e.g. platform-level test sends).
drop policy if exists "email_logs_tenant_read" on public.email_logs;
create policy "email_logs_tenant_read" on public.email_logs
  for select
  using (
    public.is_platform_admin()
    or (tenant_id is not null and public.has_tenant_access(tenant_id))
  );

-- Inserts/updates restricted to platform admin (server actions use the
-- service-role admin client when writing on behalf of tenants).
drop policy if exists "email_logs_platform_write" on public.email_logs;
create policy "email_logs_platform_write" on public.email_logs
  for all
  using      (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ── per-tenant email preferences ─────────────────────────
create table if not exists public.tenant_email_settings (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null unique references public.tenants(id) on delete cascade,
  emails_enabled        boolean not null default true,
  default_sender_name   text,
  reply_to_email        text,
  invite_expiry_days    int not null default 2,
  max_resend_count      int not null default 3,
  resend_cooldown_days  int not null default 1,
  reminder_enabled      boolean not null default true,
  reminder_after_days   int not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists tenant_email_settings_updated_at on public.tenant_email_settings;
create trigger tenant_email_settings_updated_at
  before update on public.tenant_email_settings
  for each row execute function public.handle_updated_at();

alter table public.tenant_email_settings enable row level security;

drop policy if exists "tenant_email_settings_tenant_all" on public.tenant_email_settings;
create policy "tenant_email_settings_tenant_all" on public.tenant_email_settings
  for all
  using      (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- ── email triggers ───────────────────────────────────────
create table if not exists public.email_triggers (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  event_key    text not null,
  template_key text not null,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (tenant_id, event_key)
);

create index if not exists email_triggers_tenant_idx
  on public.email_triggers (tenant_id);

alter table public.email_triggers enable row level security;

drop policy if exists "email_triggers_tenant_all" on public.email_triggers;
create policy "email_triggers_tenant_all" on public.email_triggers
  for all
  using      (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));
