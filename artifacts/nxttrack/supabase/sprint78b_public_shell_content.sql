-- ============================================================================
-- Sprint 78b — Public-shell-redesign content-velden (Fase 2)
-- ============================================================================
-- Voegt tenant-managed content toe voor de drie nieuwe modules op de
-- publieke tenant-homepage:
--   1) Welkom-kaart           → tenants.welcome_text + welcome_more_url
--   2) Locatie-kaart          → tenants.location_name + address_line1 +
--                                postal_code + city + country +
--                                latitude + longitude
--   3) Trainers-kaart         → public_trainers.role_label + photo_url +
--                                position
--
-- Idempotent. Geen RLS-wijzigingen — bestaande policies op `tenants` en
-- `public_trainers` blijven werken (read open voor anon, write alleen voor
-- tenant-admin via `has_tenant_access`).
-- ============================================================================

set search_path = public;

-- ── 1. Welkom-kaart ────────────────────────────────────────────────────────
alter table public.tenants
  add column if not exists welcome_text     text,
  add column if not exists welcome_more_url text;

alter table public.tenants
  drop constraint if exists tenants_welcome_text_len_chk;
alter table public.tenants
  add constraint tenants_welcome_text_len_chk
  check (welcome_text is null or char_length(welcome_text) <= 2000);

alter table public.tenants
  drop constraint if exists tenants_welcome_more_url_fmt_chk;
alter table public.tenants
  add constraint tenants_welcome_more_url_fmt_chk
  check (
    welcome_more_url is null
    or welcome_more_url ~ '^(https?://|/)'
  );

-- ── 2. Locatie-kaart ───────────────────────────────────────────────────────
alter table public.tenants
  add column if not exists location_name text,
  add column if not exists address_line1 text,
  add column if not exists postal_code   text,
  add column if not exists city          text,
  add column if not exists country       text,
  add column if not exists latitude      double precision,
  add column if not exists longitude     double precision;

alter table public.tenants
  drop constraint if exists tenants_latitude_range_chk;
alter table public.tenants
  add constraint tenants_latitude_range_chk
  check (latitude is null or (latitude between -90 and 90));

alter table public.tenants
  drop constraint if exists tenants_longitude_range_chk;
alter table public.tenants
  add constraint tenants_longitude_range_chk
  check (longitude is null or (longitude between -180 and 180));

-- ── 3. Trainers-kaart ──────────────────────────────────────────────────────
-- `public_trainers` is een **view** op `members` (Sprint 18). We zetten de
-- nieuwe velden op de onderliggende `members`-tabel en herbouwen de view
-- zodat deze de extra kolommen exposeert.
alter table public.members
  add column if not exists public_role_label text,
  add column if not exists public_photo_url  text,
  add column if not exists public_position   integer not null default 0;

alter table public.members
  drop constraint if exists members_public_role_label_len_chk;
alter table public.members
  add constraint members_public_role_label_len_chk
  check (
    public_role_label is null
    or char_length(public_role_label) <= 80
  );

-- View herbouwen — drop+recreate omdat de bestaande view de extra
-- kolommen niet kan tonen met een simpele `create or replace` als de
-- shape wijzigt. We behouden dezelfde RLS-pattern: alleen members met
-- `show_in_public=true`, een 'trainer'-rol én een actieve tenant.
drop view if exists public.public_trainers;
create view public.public_trainers
  with (security_invoker = true)
  as
  select
    m.id,
    m.tenant_id,
    m.full_name,
    m.public_bio,
    m.public_role_label as role_label,
    m.public_photo_url  as photo_url,
    m.public_position   as position
  from public.members m
  join public.member_roles mr
    on mr.member_id = m.id
   and mr.role = 'trainer'::text
  join public.tenants t
    on t.id = m.tenant_id
   and t.status = 'active'::text
  where m.show_in_public = true;

grant select on public.public_trainers to anon, authenticated;

-- Helper-index voor sortering / "3 random trainers"-pick — partial op
-- alleen de publiek-zichtbare members.
create index if not exists members_public_trainers_pos_idx
  on public.members (tenant_id, public_position)
  where show_in_public = true;
