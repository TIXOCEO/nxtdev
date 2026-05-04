-- Sprint 15 — Themes (light/dark sets) + custom tenant pages + SEO
--
-- Run this AFTER sprint14.sql.

-- ═════════════════════════════════════════════════════════
-- 1. Themes
-- ═════════════════════════════════════════════════════════
-- A theme is a named bundle of CSS-variable values + a mode (light|dark).
-- Scope:
--   * 'platform' — managed by platform admins, available to all tenants.
--   * 'tenant'   — owned by a single tenant.
-- `tokens` jsonb is a flat map of CSS variable name → value, e.g.
--   { "--accent": "#b6d83b", "--bg-app": "#ffffff", ... }

create table if not exists public.themes (
  id           uuid       primary key default gen_random_uuid(),
  scope        text       not null check (scope in ('platform','tenant')),
  tenant_id    uuid       references public.tenants(id) on delete cascade,
  name         text       not null,
  mode         text       not null check (mode in ('light','dark')),
  tokens       jsonb      not null default '{}'::jsonb,
  is_default   boolean    not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Tenant-scoped themes MUST have a tenant_id; platform-scoped MUST NOT.
  check ((scope = 'platform' and tenant_id is null)
      or (scope = 'tenant'   and tenant_id is not null))
);

create index if not exists themes_scope_idx  on public.themes (scope);
create index if not exists themes_tenant_idx on public.themes (tenant_id);

drop trigger if exists themes_updated_at on public.themes;
create trigger themes_updated_at
  before update on public.themes
  for each row execute function public.handle_updated_at();

alter table public.themes enable row level security;

drop policy if exists "themes_public_read"  on public.themes;
drop policy if exists "themes_platform_all" on public.themes;
drop policy if exists "themes_tenant_all"   on public.themes;

-- Anyone (including anon) can read themes — they're style data, not secrets.
create policy "themes_public_read" on public.themes
  for select using (true);

-- Platform admins manage platform themes.
create policy "themes_platform_all" on public.themes
  for all using (scope = 'platform' and public.is_platform_admin())
          with check (scope = 'platform' and public.is_platform_admin());

-- Tenant admins manage their own tenant themes.
create policy "themes_tenant_all" on public.themes
  for all using (scope = 'tenant' and tenant_id is not null
                 and public.has_tenant_access(tenant_id))
          with check (scope = 'tenant' and tenant_id is not null
                 and public.has_tenant_access(tenant_id));

-- Activation: which themes a given tenant exposes to its users.
create table if not exists public.tenant_active_themes (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  theme_id   uuid not null references public.themes(id)  on delete cascade,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, theme_id)
);

alter table public.tenant_active_themes enable row level security;

drop policy if exists "tat_public_read" on public.tenant_active_themes;
drop policy if exists "tat_tenant_all"  on public.tenant_active_themes;
create policy "tat_public_read" on public.tenant_active_themes
  for select using (true);
create policy "tat_tenant_all" on public.tenant_active_themes
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Per-user mode preference. Stored per tenant so different clubs can feel
-- different. mode_preference: 'auto' | 'light' | 'dark'.
create table if not exists public.user_theme_preferences (
  user_id          uuid not null references auth.users(id) on delete cascade,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  mode_preference  text not null default 'auto'
                       check (mode_preference in ('auto','light','dark')),
  light_theme_id   uuid references public.themes(id) on delete set null,
  dark_theme_id    uuid references public.themes(id) on delete set null,
  updated_at       timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

alter table public.user_theme_preferences enable row level security;
drop policy if exists "utp_self_all" on public.user_theme_preferences;
create policy "utp_self_all" on public.user_theme_preferences
  for all using (auth.uid() = user_id)
          with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────
-- Seed: NXTTRACK Light + Dark
-- ─────────────────────────────────────────────────────────
insert into public.themes (scope, tenant_id, name, mode, tokens, is_default)
values
('platform', null, 'NXTTRACK Light', 'light', jsonb_build_object(
  '--accent',             '#b6d83b',
  '--bg-viewport-start',  '#f4f6f8',
  '--bg-viewport-end',    '#e9ecf1',
  '--bg-app',             '#ffffff',
  '--bg-nav',             '#f8f9fb',
  '--surface-main',       '#ffffff',
  '--surface-soft',       '#f4f6fa',
  '--surface-border',     '#e3e6ee',
  '--text-primary',       '#0f172a',
  '--text-secondary',     '#5b6476',
  '--shadow-color',       'rgba(15, 23, 42, 0.08)'
), true),
('platform', null, 'NXTTRACK Dark', 'dark', jsonb_build_object(
  '--accent',             '#b6d83b',
  '--bg-viewport-start',  '#0b1220',
  '--bg-viewport-end',    '#05080f',
  '--bg-app',             '#05080f',
  '--bg-nav',             '#070b14',
  '--surface-main',       '#0b1220',
  '--surface-soft',       '#10192e',
  '--surface-border',     '#1e2a44',
  '--text-primary',       '#e6eaf2',
  '--text-secondary',     '#9aa4bf',
  '--shadow-color',       'rgba(0, 0, 0, 0.85)'
), true)
on conflict do nothing;

-- ═════════════════════════════════════════════════════════
-- 2. Custom tenant pages (CMS-light)
-- ═════════════════════════════════════════════════════════
-- Tenants can build their own menu items + pages, with optional nesting
-- (parent_id) and an auth-required toggle. Resolved by /t/[slug]/p/[...path].

create table if not exists public.tenant_custom_pages (
  id              uuid       primary key default gen_random_uuid(),
  tenant_id       uuid       not null references public.tenants(id) on delete cascade,
  parent_id       uuid       references public.tenant_custom_pages(id) on delete cascade,
  title           text       not null,
  slug            text       not null,
  content_html    text       not null default '',
  requires_auth   boolean    not null default false,
  is_enabled      boolean    not null default true,
  show_in_menu    boolean    not null default true,
  sort_order      int        not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, parent_id, slug)
);

create index if not exists tcp_tenant_idx on public.tenant_custom_pages (tenant_id);
create index if not exists tcp_parent_idx on public.tenant_custom_pages (parent_id);

drop trigger if exists tcp_updated_at on public.tenant_custom_pages;
create trigger tcp_updated_at
  before update on public.tenant_custom_pages
  for each row execute function public.handle_updated_at();

alter table public.tenant_custom_pages enable row level security;

drop policy if exists "tcp_public_read"  on public.tenant_custom_pages;
drop policy if exists "tcp_tenant_all"   on public.tenant_custom_pages;

-- Public can SELECT enabled pages — visibility checks for requires_auth happen
-- in app code (we still expose the row so the menu can render).
create policy "tcp_public_read" on public.tenant_custom_pages
  for select using (is_enabled = true);

create policy "tcp_tenant_all" on public.tenant_custom_pages
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- ═════════════════════════════════════════════════════════
-- 3. SEO — tenant defaults + per-page overrides
-- ═════════════════════════════════════════════════════════

create table if not exists public.tenant_seo_settings (
  tenant_id            uuid       primary key references public.tenants(id) on delete cascade,
  default_title        text,
  title_template       text       default '%s | %tenant%',
  default_description  text,
  default_image_url    text,
  og_site_name         text,
  twitter_handle       text,
  updated_at           timestamptz not null default now()
);

drop trigger if exists tss_updated_at on public.tenant_seo_settings;
create trigger tss_updated_at
  before update on public.tenant_seo_settings
  for each row execute function public.handle_updated_at();

alter table public.tenant_seo_settings enable row level security;
drop policy if exists "tss_public_read" on public.tenant_seo_settings;
drop policy if exists "tss_tenant_all"  on public.tenant_seo_settings;
create policy "tss_public_read" on public.tenant_seo_settings
  for select using (true);
create policy "tss_tenant_all" on public.tenant_seo_settings
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Per-page overrides (page_path is the path AFTER /t/{slug}, e.g. "" for home,
-- "nieuws", "p/contact", etc.). Tenant admin can override any page.
create table if not exists public.tenant_page_seo (
  id           uuid       primary key default gen_random_uuid(),
  tenant_id    uuid       not null references public.tenants(id) on delete cascade,
  page_path    text       not null,
  title        text,
  description  text,
  image_url    text,
  noindex      boolean    not null default false,
  updated_at   timestamptz not null default now(),
  unique (tenant_id, page_path)
);

drop trigger if exists tps_updated_at on public.tenant_page_seo;
create trigger tps_updated_at
  before update on public.tenant_page_seo
  for each row execute function public.handle_updated_at();

alter table public.tenant_page_seo enable row level security;
drop policy if exists "tps_public_read" on public.tenant_page_seo;
drop policy if exists "tps_tenant_all"  on public.tenant_page_seo;
create policy "tps_public_read" on public.tenant_page_seo for select using (true);
create policy "tps_tenant_all" on public.tenant_page_seo
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- News posts get their own SEO fields too (overrides title/excerpt for share cards).
alter table public.news_posts add column if not exists seo_title       text;
alter table public.news_posts add column if not exists seo_description text;
alter table public.news_posts add column if not exists seo_image_url   text;
