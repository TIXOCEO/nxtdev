-- ═════════════════════════════════════════════════════════════════
-- Sprint 60 — Programs MVP (v0.16.0)
--
-- Voegt de "programs"-laag toe als generieke planning-eenheid bovenop
-- de bestaande groups/training_sessions stack. Programs leveren
-- defaults (capaciteit, flex-capaciteit, min-instructeurs, marketplace-
-- velden) en aggregeren 1..N groups via een join-tabel.
--
-- Files in deze sprint:
--   * sprint60_programs.sql           (deze)
--   * sprint60_release_v0_16_0.sql    (release-notes-row)
--
-- Houtrust-veiligheid:
--   - Alle nieuwe FK's (groups.program_id) zijn NULLABLE.
--   - Geen backfill die bestaande Houtrust-data raakt.
--   - Bij program_id IS NULL gedraagt UI/RLS/cron zich identiek.
--
-- Idempotent — drop+create / if not exists overal.
-- ═════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. Composite (id, tenant_id) uniques op bestaande tabellen.
--
-- Vereiste voor tenant-veilige composite FK's vanuit join-tabellen
-- (zie §3.5 van docs/programs-foundation-research.md). We zetten ze
-- alvast op alle 5 tabellen die latere sprints (61-64) ook gaan
-- gebruiken — schema-niveau-isolatie tussen tenants kost niets en
-- maakt de Sprint 61-migratie kleiner.
-- ─────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'groups_id_tenant_uq'
  ) then
    alter table public.groups add constraint groups_id_tenant_uq unique (id, tenant_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'members_id_tenant_uq'
  ) then
    alter table public.members add constraint members_id_tenant_uq unique (id, tenant_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'capacity_resources_id_tenant_uq'
  ) then
    alter table public.capacity_resources add constraint capacity_resources_id_tenant_uq unique (id, tenant_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'membership_plans_id_tenant_uq'
  ) then
    alter table public.membership_plans add constraint membership_plans_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────
-- 2. programs — de planning-eenheid.
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.programs (
  id                              uuid primary key default gen_random_uuid(),
  tenant_id                       uuid not null references public.tenants(id) on delete cascade,
  slug                            text not null,
  public_slug                     text,
  name                            text not null,
  marketing_title                 text,
  marketing_description           text,
  hero_image_url                  text,
  cta_label                       text,
  visibility                      text not null default 'internal'
                                  check (visibility in ('public','internal','archived')),
  default_capacity                int  check (default_capacity is null or default_capacity > 0),
  default_flex_capacity           int  check (default_flex_capacity is null or default_flex_capacity >= 0),
  default_min_instructors         int  not null default 1
                                  check (default_min_instructors >= 0),
  capacity_purpose_defaults_json  jsonb not null default '{}'::jsonb,
  age_min                         int  check (age_min is null or age_min >= 0),
  age_max                         int,
  highlights_json                 jsonb not null default '[]'::jsonb,
  sort_order                      int  not null default 0,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'programs_age_range_chk') then
    alter table public.programs
      add constraint programs_age_range_chk
      check (age_max is null or age_min is null or age_max >= age_min);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'programs_public_requires_slug_chk') then
    alter table public.programs
      add constraint programs_public_requires_slug_chk
      check (visibility <> 'public' or public_slug is not null);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'programs_slug_tenant_uq') then
    alter table public.programs
      add constraint programs_slug_tenant_uq unique (tenant_id, slug);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'programs_public_slug_tenant_uq') then
    alter table public.programs
      add constraint programs_public_slug_tenant_uq unique (tenant_id, public_slug);
  end if;

  -- Composite (id, tenant_id) uniqueness — vereist voor join-tabel FK's.
  if not exists (select 1 from pg_constraint where conname = 'programs_id_tenant_uq') then
    alter table public.programs add constraint programs_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

create index if not exists programs_tenant_visibility_idx
  on public.programs (tenant_id, visibility, sort_order);

create index if not exists programs_marketplace_idx
  on public.programs (tenant_id, public_slug)
  where visibility = 'public';

drop trigger if exists programs_updated_at on public.programs;
create trigger programs_updated_at
  before update on public.programs
  for each row execute function public.handle_updated_at();

alter table public.programs enable row level security;

drop policy if exists "programs_tenant_all" on public.programs;
create policy "programs_tenant_all" on public.programs
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- ─────────────────────────────────────────────────────────────────
-- 3. groups.program_id — nullable hint naar het "primaire" program.
--    Dit is een denormalized read-helper die door trigger
--    enforce_group_primary_program (§4) in sync wordt gehouden met
--    program_groups (is_primary=true).
-- ─────────────────────────────────────────────────────────────────
alter table public.groups
  add column if not exists program_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'groups_program_id_fk') then
    alter table public.groups
      add constraint groups_program_id_fk
      foreign key (program_id) references public.programs(id) on delete set null;
  end if;
end $$;

create index if not exists groups_program_idx
  on public.groups (program_id)
  where program_id is not null;

-- ─────────────────────────────────────────────────────────────────
-- 4. program_groups — many-to-many program ↔ group.
--    tenant_id gedenormaliseerd voor RLS-snelheid, gegarandeerd
--    consistent via composite FK's naar (programs|groups)(id, tenant_id).
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.program_groups (
  program_id  uuid not null,
  group_id    uuid not null,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  is_primary  boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  primary key (program_id, group_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'program_groups_program_tenant_fk'
  ) then
    alter table public.program_groups
      add constraint program_groups_program_tenant_fk
      foreign key (program_id, tenant_id)
      references public.programs (id, tenant_id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'program_groups_group_tenant_fk'
  ) then
    alter table public.program_groups
      add constraint program_groups_group_tenant_fk
      foreign key (group_id, tenant_id)
      references public.groups (id, tenant_id) on delete cascade;
  end if;
end $$;

create index if not exists program_groups_group_idx
  on public.program_groups (group_id);

create index if not exists program_groups_tenant_program_idx
  on public.program_groups (tenant_id, program_id, sort_order);

-- Eén "primaire" groep per program — partial unique index.
drop index if exists program_groups_primary_uq;
create unique index program_groups_primary_uq
  on public.program_groups (program_id)
  where is_primary = true;

alter table public.program_groups enable row level security;

drop policy if exists "program_groups_tenant_all" on public.program_groups;
create policy "program_groups_tenant_all" on public.program_groups
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- ─────────────────────────────────────────────────────────────────
-- 5. Trigger enforce_group_primary_program — houdt
--    groups.program_id in sync met program_groups (is_primary=true).
--    UI gebruikt program_groups als bron-van-waarheid; deze trigger
--    propageert naar de denormalized hint-kolom op groups.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.enforce_group_primary_program()
returns trigger
language plpgsql
as $$
declare
  v_group_id  uuid;
  v_primary   uuid;
begin
  if tg_op = 'DELETE' then
    v_group_id := old.group_id;
  else
    v_group_id := new.group_id;
  end if;

  -- Bereken de huidige primary-program voor deze groep.
  select program_id into v_primary
    from public.program_groups
   where group_id = v_group_id
     and is_primary = true
   limit 1;

  update public.groups
     set program_id = v_primary
   where id = v_group_id
     and (program_id is distinct from v_primary);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists program_groups_sync_primary on public.program_groups;
create trigger program_groups_sync_primary
  after insert or update or delete on public.program_groups
  for each row execute function public.enforce_group_primary_program();

-- ═════════════════════════════════════════════════════════════════
-- 6. Terminology — nieuwe keys in alle drie sector-templates.
--    Sprint 47-patroon: jsonb-merge via `||`, alleen toevoegen wat
--    nog niet bestaat (jsonb_build_object overschrijft alleen de
--    nieuwe keys, oude blijven ongewijzigd).
-- ═════════════════════════════════════════════════════════════════
update public.sector_templates
   set terminology_json = terminology_json
       || jsonb_build_object(
            'programs_page_description',     'Beheer programma''s en publieke zichtbaarheid.',
            'programs_marketplace_title',    'Ons aanbod',
            'programs_marketplace_intro',    'Bekijk ons volledige aanbod.',
            'programs_new_button',           'Nieuw programma',
            'program_assignment_lead_label', 'Hoofdbegeleider',
            'membership_plan_singular',      'Plan',
            'membership_plan_plural',        'Plannen'
          )
 where key = 'generic';

update public.sector_templates
   set terminology_json = terminology_json
       || jsonb_build_object(
            'programs_page_description',     'Beheer aanbod, prijzen en publieke zichtbaarheid van uw lidmaatschappen.',
            'programs_marketplace_title',    'Ons aanbod',
            'programs_marketplace_intro',    'Bekijk welke lidmaatschappen wij aanbieden.',
            'programs_new_button',           'Nieuw lidmaatschap',
            'program_assignment_lead_label', 'Hoofdtrainer',
            'membership_plan_singular',      'Tarief',
            'membership_plan_plural',        'Tarieven'
          )
 where key = 'football_school';

update public.sector_templates
   set terminology_json = terminology_json
       || jsonb_build_object(
            'programs_page_description',     'Beheer lespakketten, prijzen en zichtbaarheid op uw publieke pagina.',
            'programs_marketplace_title',    'Onze lespakketten',
            'programs_marketplace_intro',    'Bekijk welke lespakketten wij aanbieden.',
            'programs_new_button',           'Nieuw lespakket',
            'program_assignment_lead_label', 'Hoofdinstructeur',
            'membership_plan_singular',      'Prijsplan',
            'membership_plan_plural',        'Prijsplannen'
          )
 where key = 'swimming_school';

-- ═════════════════════════════════════════════════════════════════
-- 7. Verificatie-queries (als comment).
--
--   select count(*) from public.programs;            -- 0 voor nieuwe deploy
--   select 1 from pg_constraint where conname = 'programs_id_tenant_uq';
--   select 1 from pg_constraint where conname = 'program_groups_program_tenant_fk';
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='groups' and column_name='program_id';
--   select terminology_json ? 'programs_new_button'
--     from public.sector_templates where key='generic';
-- ═════════════════════════════════════════════════════════════════
