-- ─────────────────────────────────────────────────────────
-- NXTTRACK — Supabase Schema  (Sprint 3)
-- Run in: Supabase Dashboard → SQL Editor
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────
-- Migration: Sprint 2 created `memberships`. Rename to
-- `tenant_memberships` if needed before any other DDL.
-- ──────────────────────────────────────────────────────────
do $$
begin
  if exists (
       select 1 from information_schema.tables
       where table_schema='public' and table_name='memberships'
     )
     and not exists (
       select 1 from information_schema.tables
       where table_schema='public' and table_name='tenant_memberships'
     ) then
    execute 'alter table public.memberships rename to tenant_memberships';
  end if;
end $$;

-- ──────────────────────────────────────────────────────────
-- 1. profiles
-- ──────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz default now()
);

-- ──────────────────────────────────────────────────────────
-- 2. tenants
-- ──────────────────────────────────────────────────────────
create table if not exists public.tenants (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  slug            text        unique not null,
  logo_url        text,
  primary_color   text        default '#b6d83b',
  contact_email   text,
  status          text        default 'active',
  domain          text,
  settings_json   jsonb       default '{}'::jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ──────────────────────────────────────────────────────────
-- 3. tenant_memberships
-- tenant_id may be NULL ONLY for platform_admin.
-- ──────────────────────────────────────────────────────────
create table if not exists public.tenant_memberships (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        references public.tenants (id) on delete cascade,
  user_id     uuid        not null references public.profiles (id) on delete cascade,
  role        text        not null,
  created_at  timestamptz default now()
);

-- Migration: ensure tenant_id is nullable (was NOT NULL in Sprint 2)
alter table public.tenant_memberships alter column tenant_id drop not null;

-- Migration: replace any prior role check
alter table public.tenant_memberships drop constraint if exists memberships_role_check;
alter table public.tenant_memberships drop constraint if exists tenant_memberships_role_check;
alter table public.tenant_memberships
  add constraint tenant_memberships_role_check
  check (role in ('platform_admin', 'tenant_admin', 'parent', 'member'));

-- Enforce: platform_admin must have NULL tenant_id; others must NOT.
alter table public.tenant_memberships drop constraint if exists tenant_memberships_role_tenant_check;
alter table public.tenant_memberships
  add constraint tenant_memberships_role_tenant_check
  check (
    (role = 'platform_admin' and tenant_id is null)
    or (role <> 'platform_admin' and tenant_id is not null)
  );

-- ──────────────────────────────────────────────────────────
-- 4. news_categories
-- ──────────────────────────────────────────────────────────
create table if not exists public.news_categories (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants (id) on delete cascade,
  name        text        not null,
  slug        text        not null,
  created_at  timestamptz default now(),
  unique (tenant_id, slug)
);

-- ──────────────────────────────────────────────────────────
-- 5. news_posts
-- ──────────────────────────────────────────────────────────
create table if not exists public.news_posts (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants (id) on delete cascade,
  title           text        not null,
  slug            text        not null,
  excerpt         text,
  content_json    jsonb,
  content_html    text,
  cover_image_url text,
  category_id     uuid        references public.news_categories (id) on delete set null,
  status          text        default 'draft',
  published_at    timestamptz,
  created_by      uuid        references public.profiles (id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (tenant_id, slug)
);

-- ──────────────────────────────────────────────────────────
-- 6. registrations
-- ──────────────────────────────────────────────────────────
create table if not exists public.registrations (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants (id) on delete cascade,
  parent_name   text        not null,
  parent_email  text        not null,
  parent_phone  text,
  child_name    text        not null,
  child_age     int,
  message       text,
  status        text        default 'new',
  created_at    timestamptz default now()
);

-- ──────────────────────────────────────────────────────────
-- 7. media_assets
-- ──────────────────────────────────────────────────────────
create table if not exists public.media_assets (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants (id) on delete cascade,
  url           text        not null,
  path          text        not null,
  file_type     text,
  uploaded_by   uuid        references public.profiles (id),
  created_at    timestamptz default now()
);

-- ──────────────────────────────────────────────────────────
-- 8. athletes
-- athlete_code is auto-generated by trigger if empty.
-- ──────────────────────────────────────────────────────────
create table if not exists public.athletes (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants (id) on delete cascade,
  full_name       text        not null,
  date_of_birth   date,
  athlete_code    text        unique not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ──────────────────────────────────────────────────────────
-- 9. parent_athlete_links
-- ──────────────────────────────────────────────────────────
create table if not exists public.parent_athlete_links (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants (id) on delete cascade,
  parent_user_id  uuid        not null references public.profiles (id) on delete cascade,
  athlete_id      uuid        not null references public.athletes (id) on delete cascade,
  link_status     text        default 'active',
  created_at      timestamptz default now(),
  unique (parent_user_id, athlete_id)
);

-- ═════════════════════════════════════════════════════════
--  HELPER FUNCTIONS
-- ═════════════════════════════════════════════════════════

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_memberships
    where user_id = auth.uid()
      and role = 'platform_admin'
      and tenant_id is null
  );
$$;

create or replace function public.is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_memberships
    where user_id = auth.uid()
      and tenant_id = target_tenant_id
      and role = 'tenant_admin'
  );
$$;

create or replace function public.has_tenant_access(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin() or public.is_tenant_admin(target_tenant_id);
$$;

-- 8-character A-Z athlete code, retried until unique.
create or replace function public.generate_athlete_code()
returns text
language plpgsql
as $$
declare
  chars     text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result    text;
  i         int;
  attempts  int := 0;
begin
  loop
    result := '';
    for i in 1..8 loop
      result := result || substr(chars, 1 + floor(random() * 26)::int, 1);
    end loop;

    if not exists (select 1 from public.athletes where athlete_code = result) then
      return result;
    end if;

    attempts := attempts + 1;
    if attempts > 100 then
      raise exception 'Failed to generate unique athlete code after 100 attempts';
    end if;
  end loop;
end;
$$;

-- ═════════════════════════════════════════════════════════
--  TRIGGERS
-- ═════════════════════════════════════════════════════════

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenants_updated_at on public.tenants;
create trigger tenants_updated_at
  before update on public.tenants
  for each row execute function public.handle_updated_at();

drop trigger if exists news_posts_updated_at on public.news_posts;
create trigger news_posts_updated_at
  before update on public.news_posts
  for each row execute function public.handle_updated_at();

drop trigger if exists athletes_updated_at on public.athletes;
create trigger athletes_updated_at
  before update on public.athletes
  for each row execute function public.handle_updated_at();

-- Auto-generate athlete_code when missing
create or replace function public.set_athlete_code()
returns trigger
language plpgsql
as $$
begin
  if new.athlete_code is null or new.athlete_code = '' then
    new.athlete_code := public.generate_athlete_code();
  end if;
  return new;
end;
$$;

drop trigger if exists athletes_set_code on public.athletes;
create trigger athletes_set_code
  before insert on public.athletes
  for each row execute function public.set_athlete_code();

-- Enforce parent_athlete_links.tenant_id MUST equal athletes.tenant_id.
-- Prevents cross-tenant linking of an athlete UUID into a different tenant.
create or replace function public.enforce_link_tenant_consistency()
returns trigger
language plpgsql
as $$
declare
  athlete_tenant uuid;
begin
  select tenant_id into athlete_tenant
  from public.athletes
  where id = new.athlete_id;

  if athlete_tenant is null then
    raise exception 'parent_athlete_links: athlete_id % does not exist', new.athlete_id;
  end if;

  if new.tenant_id is null then
    new.tenant_id := athlete_tenant;
  elsif new.tenant_id <> athlete_tenant then
    raise exception
      'parent_athlete_links.tenant_id (%) must match athletes.tenant_id (%)',
      new.tenant_id, athlete_tenant;
  end if;

  return new;
end;
$$;

drop trigger if exists parent_athlete_links_tenant_check on public.parent_athlete_links;
create trigger parent_athlete_links_tenant_check
  before insert or update on public.parent_athlete_links
  for each row execute function public.enforce_link_tenant_consistency();

-- ═════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═════════════════════════════════════════════════════════

alter table public.profiles              enable row level security;
alter table public.tenants               enable row level security;
alter table public.tenant_memberships    enable row level security;
alter table public.news_categories       enable row level security;
alter table public.news_posts            enable row level security;
alter table public.registrations         enable row level security;
alter table public.media_assets          enable row level security;
alter table public.athletes              enable row level security;
alter table public.parent_athlete_links  enable row level security;

-- ── PROFILES ──────────────────────────────────────────────
drop policy if exists "profiles_self_read"      on public.profiles;
drop policy if exists "profiles_self_update"    on public.profiles;
drop policy if exists "profiles_self_insert"    on public.profiles;
drop policy if exists "profiles_admin_read"     on public.profiles;
drop policy if exists "Users can read own profile"   on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_self_insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_admin_read" on public.profiles
  for select using (public.is_platform_admin());

-- ── TENANTS ───────────────────────────────────────────────
drop policy if exists "tenants_public_read"   on public.tenants;
drop policy if exists "tenants_admin_all"     on public.tenants;
drop policy if exists "tenants_owner_read"    on public.tenants;
drop policy if exists "tenants_owner_update"  on public.tenants;

create policy "tenants_public_read" on public.tenants
  for select using (status = 'active');

create policy "tenants_admin_all" on public.tenants
  for all  using (public.is_platform_admin())
           with check (public.is_platform_admin());

create policy "tenants_owner_read" on public.tenants
  for select using (public.is_tenant_admin(id));

create policy "tenants_owner_update" on public.tenants
  for update using (public.is_tenant_admin(id))
           with check (public.is_tenant_admin(id));

-- ── TENANT_MEMBERSHIPS ────────────────────────────────────
drop policy if exists "memberships_self_read"    on public.tenant_memberships;
drop policy if exists "memberships_admin_all"    on public.tenant_memberships;
drop policy if exists "memberships_tenant_read"  on public.tenant_memberships;
drop policy if exists "Users can read own memberships" on public.tenant_memberships;

create policy "memberships_self_read" on public.tenant_memberships
  for select using (auth.uid() = user_id);

create policy "memberships_admin_all" on public.tenant_memberships
  for all  using (public.is_platform_admin())
           with check (public.is_platform_admin());

create policy "memberships_tenant_read" on public.tenant_memberships
  for select using (tenant_id is not null and public.is_tenant_admin(tenant_id));

-- ── NEWS_CATEGORIES ───────────────────────────────────────
drop policy if exists "news_cat_public_read" on public.news_categories;
drop policy if exists "news_cat_tenant_all"  on public.news_categories;

create policy "news_cat_public_read" on public.news_categories
  for select using (true);

create policy "news_cat_tenant_all" on public.news_categories
  for all  using (public.has_tenant_access(tenant_id))
           with check (public.has_tenant_access(tenant_id));

-- ── NEWS_POSTS ────────────────────────────────────────────
drop policy if exists "news_posts_public_read" on public.news_posts;
drop policy if exists "news_posts_tenant_all"  on public.news_posts;

create policy "news_posts_public_read" on public.news_posts
  for select using (status = 'published');

create policy "news_posts_tenant_all" on public.news_posts
  for all  using (public.has_tenant_access(tenant_id))
           with check (public.has_tenant_access(tenant_id));

-- ── REGISTRATIONS ─────────────────────────────────────────
drop policy if exists "registrations_public_insert" on public.registrations;
drop policy if exists "registrations_tenant_all"    on public.registrations;

create policy "registrations_public_insert" on public.registrations
  for insert with check (true);

create policy "registrations_tenant_all" on public.registrations
  for all  using (public.has_tenant_access(tenant_id))
           with check (public.has_tenant_access(tenant_id));

-- ── MEDIA_ASSETS ──────────────────────────────────────────
drop policy if exists "media_public_read"  on public.media_assets;
drop policy if exists "media_tenant_all"   on public.media_assets;

create policy "media_public_read" on public.media_assets
  for select using (true);

create policy "media_tenant_all" on public.media_assets
  for all  using (public.has_tenant_access(tenant_id))
           with check (public.has_tenant_access(tenant_id));

-- ── ATHLETES ──────────────────────────────────────────────
drop policy if exists "athletes_tenant_all"     on public.athletes;
drop policy if exists "athletes_parent_read"    on public.athletes;

create policy "athletes_tenant_all" on public.athletes
  for all  using (public.has_tenant_access(tenant_id))
           with check (public.has_tenant_access(tenant_id));

-- Defense in depth: also require the link row's tenant_id to match the
-- athlete row, so even a stale/mismatched link cannot expose another tenant.
create policy "athletes_parent_read" on public.athletes
  for select using (
    exists (
      select 1 from public.parent_athlete_links pal
      where pal.athlete_id     = athletes.id
        and pal.parent_user_id = auth.uid()
        and pal.link_status    = 'active'
        and pal.tenant_id      = athletes.tenant_id
    )
  );

-- ── PARENT_ATHLETE_LINKS ──────────────────────────────────
drop policy if exists "links_parent_read"  on public.parent_athlete_links;
drop policy if exists "links_tenant_all"   on public.parent_athlete_links;

create policy "links_parent_read" on public.parent_athlete_links
  for select using (auth.uid() = parent_user_id);

create policy "links_tenant_all" on public.parent_athlete_links
  for all  using (public.has_tenant_access(tenant_id))
           with check (public.has_tenant_access(tenant_id));

-- ═════════════════════════════════════════════════════════
--  INDEXES
-- ═════════════════════════════════════════════════════════
create index if not exists tenants_slug_idx                       on public.tenants               (slug);
create index if not exists tenants_domain_idx                     on public.tenants               (domain);
create index if not exists tenant_memberships_user_id_idx         on public.tenant_memberships    (user_id);
create index if not exists tenant_memberships_tenant_id_idx       on public.tenant_memberships    (tenant_id);
create index if not exists news_posts_tenant_id_idx               on public.news_posts            (tenant_id);
create index if not exists news_posts_slug_idx                    on public.news_posts            (slug);
create index if not exists news_posts_status_idx                  on public.news_posts            (status);
create index if not exists news_categories_tenant_id_idx          on public.news_categories       (tenant_id);
create index if not exists registrations_tenant_id_idx            on public.registrations         (tenant_id);
create index if not exists media_assets_tenant_id_idx             on public.media_assets          (tenant_id);
create index if not exists athletes_tenant_id_idx                 on public.athletes              (tenant_id);
create index if not exists athletes_athlete_code_idx              on public.athletes              (athlete_code);
create index if not exists parent_athlete_links_parent_user_idx   on public.parent_athlete_links  (parent_user_id);
create index if not exists parent_athlete_links_athlete_id_idx    on public.parent_athlete_links  (athlete_id);
