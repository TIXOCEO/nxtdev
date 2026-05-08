-- ──────────────────────────────────────────────────────────
-- Sprint 49 — Wachtlijsten + tenant-instelling intake_default
--
--   1. Tabellen waitlists / waitlist_entries / waitlist_offers
--      (geen public_insert-policy: het bestaande publieke aanmeldformulier
--       schrijft via de service-role action — zie C2 in de TS-laag).
--   2. Tenant-instelling `tenants.settings_json -> intake_default`
--      ('registration' default | 'waitlist'), plus optioneel
--      `intake_overrides_by_target` (object: { "<target>": "..." }).
--   3. Backfill: alle bestaande tenants krijgen expliciet
--      `intake_default = 'registration'` zodat Houtrust niet wijzigt.
--
-- Volledig idempotent.
-- ──────────────────────────────────────────────────────────

create table if not exists public.waitlists (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  group_id    uuid        references public.groups(id) on delete cascade,
  name        text        not null,
  description text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists waitlists_tenant_idx on public.waitlists (tenant_id);
create index if not exists waitlists_group_idx  on public.waitlists (group_id);

drop trigger if exists waitlists_updated_at on public.waitlists;
create trigger waitlists_updated_at
  before update on public.waitlists
  for each row execute function public.handle_updated_at();

alter table public.waitlists enable row level security;

drop policy if exists "waitlists_tenant_all" on public.waitlists;
create policy "waitlists_tenant_all" on public.waitlists
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- ── Aanvragen ──────────────────────────────────────────────────────
create table if not exists public.waitlist_entries (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants(id) on delete cascade,
  waitlist_id     uuid        references public.waitlists(id) on delete set null,
  -- Brondetails uit het publieke formulier (gespiegeld zoals public.registrations).
  parent_name     text,
  parent_email    text        not null,
  parent_phone    text,
  child_name      text,
  date_of_birth   date,
  player_type     text,
  address         text,
  postal_code     text,
  city            text,
  extra_details   text,
  athletes_json   jsonb       not null default '[]'::jsonb,
  registration_target text,
  agreed_terms    boolean     not null default false,
  -- Status van de aanvraag.
  status          text        not null default 'waiting'
                  check (status in ('waiting','offered','accepted','declined','expired','converted','cancelled')),
  priority        int         not null default 0,
  source          text        not null default 'public_form'
                  check (source in ('public_form','manual','converted_from_registration')),
  source_registration_id uuid references public.registrations(id) on delete set null,
  member_id       uuid        references public.members(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- GDPR: bewaar het toestemmingsvinkje ook voor wachtlijst-aanmeldingen.
alter table public.waitlist_entries
  add column if not exists agreed_terms boolean not null default false;

create index if not exists waitlist_entries_tenant_idx
  on public.waitlist_entries (tenant_id, status, created_at desc);
create index if not exists waitlist_entries_waitlist_idx
  on public.waitlist_entries (waitlist_id, status, priority desc, created_at);
create index if not exists waitlist_entries_email_idx
  on public.waitlist_entries (tenant_id, lower(parent_email));

drop trigger if exists waitlist_entries_updated_at on public.waitlist_entries;
create trigger waitlist_entries_updated_at
  before update on public.waitlist_entries
  for each row execute function public.handle_updated_at();

alter table public.waitlist_entries enable row level security;

drop policy if exists "waitlist_entries_tenant_all" on public.waitlist_entries;
create policy "waitlist_entries_tenant_all" on public.waitlist_entries
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- ── Aanbiedingen (één rij per oplichting van een vrije plek) ─────
create table if not exists public.waitlist_offers (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  entry_id      uuid        not null references public.waitlist_entries(id) on delete cascade,
  group_id      uuid        references public.groups(id) on delete set null,
  decision_token text       not null unique,
  expires_at    timestamptz not null,
  status        text        not null default 'pending'
                check (status in ('pending','accepted','declined','expired','cancelled')),
  decided_at    timestamptz,
  created_by    uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists waitlist_offers_entry_idx
  on public.waitlist_offers (entry_id, status, created_at desc);
create index if not exists waitlist_offers_token_idx
  on public.waitlist_offers (decision_token);

alter table public.waitlist_offers enable row level security;

drop policy if exists "waitlist_offers_tenant_all" on public.waitlist_offers;
create policy "waitlist_offers_tenant_all" on public.waitlist_offers
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- ── Backfill: expliciete intake_default = 'registration' op elke tenant ───
update public.tenants
   set settings_json = coalesce(settings_json, '{}'::jsonb)
       || jsonb_build_object('intake_default', 'registration')
 where coalesce(settings_json -> 'intake_default', 'null'::jsonb) = 'null'::jsonb;
