-- Sprint 18 — Modular Homepage CMS v2

-- ───────────────────────────────────────────────────────────────
-- 1. modules_catalog (platform-level registry)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.modules_catalog (
  id           uuid primary key default gen_random_uuid(),
  key          text unique not null,
  name         text not null,
  description  text,
  config_schema jsonb not null default '{}'::jsonb,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

insert into public.modules_catalog (key, name, description) values
  ('hero_slider',          'Hero slider',           'Diavoorstelling met titel, tekst en CTA.'),
  ('news',                 'Nieuws',                'Toon de laatste nieuwsberichten.'),
  ('custom_content',       'Eigen content',         'Vrije tekstblok via de rich-text editor.'),
  ('video',                'Video',                 'YouTube of Vimeo video embed.'),
  ('cta',                  'Call to action',        'Knopblok dat verwijst naar een interne of externe pagina.'),
  ('sponsors',             'Sponsoren',             'Toon sponsorlogo''s in een raster of carrousel.'),
  ('events_trainings',     'Evenementen & trainingen', 'Aankomende trainingen en events.'),
  ('media_wall',           'Media Wall',            'Beeld en video wand.'),
  ('personal_dashboard',   'Persoonlijk dashboard', 'Persoonlijk overzicht voor ingelogde gebruikers.'),
  ('alerts_announcements', 'Alerts & aankondigingen', 'Toon actieve alerts en aankondigingen.'),
  ('trainers',             'Trainers',              'Toon trainers met publieke bio.')
on conflict (key) do update set name = excluded.name, description = excluded.description;

-- ───────────────────────────────────────────────────────────────
-- 2. tenant_modules (per-tenant homepage instances)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.tenant_modules (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  module_key      text not null references public.modules_catalog(key),
  title           text,
  size            text not null default '1x1' check (size in ('1x1','1x2','2x1')),
  position        int  not null default 0,
  position_mobile int,
  visible_for     text not null default 'public' check (visible_for in ('public','logged_in')),
  visible_mobile  boolean not null default true,
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_tenant_modules_position on public.tenant_modules(tenant_id, position);
create index if not exists idx_tenant_modules_position_mobile on public.tenant_modules(tenant_id, position_mobile);

-- Force personal_dashboard to logged_in.
create or replace function public.tenant_modules_force_visibility()
returns trigger language plpgsql as $$
begin
  if NEW.module_key = 'personal_dashboard' then
    NEW.visible_for := 'logged_in';
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;
drop trigger if exists tenant_modules_force_visibility on public.tenant_modules;
create trigger tenant_modules_force_visibility
  before insert or update on public.tenant_modules
  for each row execute function public.tenant_modules_force_visibility();

-- ───────────────────────────────────────────────────────────────
-- 3. alerts
-- ───────────────────────────────────────────────────────────────
create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  title       text not null,
  content     text,
  type        text not null default 'announcement' check (type in ('alert','announcement')),
  is_active   boolean not null default true,
  start_at    timestamptz,
  end_at      timestamptz,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_alerts_active on public.alerts(tenant_id, is_active, start_at, end_at);

-- ───────────────────────────────────────────────────────────────
-- 4. media_wall_items
-- ───────────────────────────────────────────────────────────────
create table if not exists public.media_wall_items (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  title       text,
  media_url   text not null,
  media_type  text not null check (media_type in ('image','video')),
  position    int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_media_wall_position on public.media_wall_items(tenant_id, position);

-- ───────────────────────────────────────────────────────────────
-- 5. sponsors
-- ───────────────────────────────────────────────────────────────
create table if not exists public.sponsors (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text not null,
  logo_url     text,
  website_url  text,
  position     int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_sponsors_position on public.sponsors(tenant_id, position);

-- ───────────────────────────────────────────────────────────────
-- 6. members public trainer fields
-- ───────────────────────────────────────────────────────────────
alter table public.members add column if not exists public_bio text;
alter table public.members add column if not exists show_in_public boolean not null default false;
create index if not exists idx_members_public on public.members(tenant_id, show_in_public);

-- ───────────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────────
alter table public.modules_catalog   enable row level security;
alter table public.tenant_modules    enable row level security;
alter table public.alerts            enable row level security;
alter table public.media_wall_items  enable row level security;
alter table public.sponsors          enable row level security;

-- modules_catalog
drop policy if exists "modcat_select" on public.modules_catalog;
create policy "modcat_select" on public.modules_catalog
  for select using (is_active = true or public.is_platform_admin());
drop policy if exists "modcat_admin_all" on public.modules_catalog;
create policy "modcat_admin_all" on public.modules_catalog
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- tenant_modules
drop policy if exists "tmod_select" on public.tenant_modules;
create policy "tmod_select" on public.tenant_modules
  for select using (
    public.has_tenant_access(tenant_id)
    or exists (select 1 from public.tenants t where t.id = tenant_id and t.status = 'active')
  );
drop policy if exists "tmod_admin_all" on public.tenant_modules;
create policy "tmod_admin_all" on public.tenant_modules
  for all using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- alerts
drop policy if exists "alerts_select" on public.alerts;
create policy "alerts_select" on public.alerts
  for select using (
    public.has_tenant_access(tenant_id)
    or (
      is_active = true
      and (start_at is null or now() >= start_at)
      and (end_at   is null or now() <= end_at)
      and exists (select 1 from public.tenants t where t.id = tenant_id and t.status = 'active')
    )
  );
drop policy if exists "alerts_admin_all" on public.alerts;
create policy "alerts_admin_all" on public.alerts
  for all using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- media_wall_items
drop policy if exists "mwall_select" on public.media_wall_items;
create policy "mwall_select" on public.media_wall_items
  for select using (
    public.has_tenant_access(tenant_id)
    or (
      is_active = true
      and exists (select 1 from public.tenants t where t.id = tenant_id and t.status = 'active')
    )
  );
drop policy if exists "mwall_admin_all" on public.media_wall_items;
create policy "mwall_admin_all" on public.media_wall_items
  for all using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- sponsors
drop policy if exists "sp_select" on public.sponsors;
create policy "sp_select" on public.sponsors
  for select using (
    public.has_tenant_access(tenant_id)
    or (
      is_active = true
      and exists (select 1 from public.tenants t where t.id = tenant_id and t.status = 'active')
    )
  );
drop policy if exists "sp_admin_all" on public.sponsors;
create policy "sp_admin_all" on public.sponsors
  for all using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- Public-facing trainer view (only safe public fields).
create or replace view public.public_trainers as
  select m.id, m.tenant_id, m.full_name, m.public_bio
  from public.members m
  join public.member_roles mr on mr.member_id = m.id and mr.role = 'trainer'
  join public.tenants t on t.id = m.tenant_id and t.status = 'active'
  where m.show_in_public = true;
grant select on public.public_trainers to anon, authenticated;
