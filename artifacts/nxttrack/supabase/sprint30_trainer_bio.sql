-- Sprint 30 — Trainersbio formulier (tenant-CMS), profieltab, publieke bio + trainerskaartjes module.
-- Run AFTER sprint29_homepage_modules_v2.sql. Idempotent.

-- ═════════════════════════════════════════════════════════
-- 1. Tenant-rol kan worden gemarkeerd als "trainer-rol"
--    (naast de system-rol 'trainer' in member_roles).
-- ═════════════════════════════════════════════════════════
alter table public.tenant_roles
  add column if not exists is_trainer_role boolean not null default false;

-- ═════════════════════════════════════════════════════════
-- 2. Trainersbio template (per tenant) + antwoorden (per member).
-- ═════════════════════════════════════════════════════════
create table if not exists public.trainer_bio_sections (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  key         text not null,
  label       text not null,
  description text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, key)
);
create index if not exists idx_tbs_tenant on public.trainer_bio_sections(tenant_id, sort_order);

create table if not exists public.trainer_bio_fields (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  section_id  uuid not null references public.trainer_bio_sections(id) on delete cascade,
  key         text not null,
  label       text not null,
  field_type  text not null check (field_type in ('short_text','long_text','bullet_list','number','date')),
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, section_id, key)
);
create index if not exists idx_tbf_section on public.trainer_bio_fields(section_id, sort_order);

create table if not exists public.trainer_bio_answers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  field_id    uuid not null references public.trainer_bio_fields(id) on delete cascade,
  value_text  text,
  value_number numeric,
  value_date  date,
  value_list  jsonb,
  updated_at  timestamptz not null default now(),
  unique (member_id, field_id)
);
create index if not exists idx_tba_member on public.trainer_bio_answers(member_id);
create index if not exists idx_tba_tenant on public.trainer_bio_answers(tenant_id);

-- updated_at triggers (hergebruik bestaande set_updated_at functie als die er is).
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    execute 'drop trigger if exists tbs_updated_at on public.trainer_bio_sections';
    execute 'create trigger tbs_updated_at before update on public.trainer_bio_sections for each row execute procedure public.set_updated_at()';
    execute 'drop trigger if exists tbf_updated_at on public.trainer_bio_fields';
    execute 'create trigger tbf_updated_at before update on public.trainer_bio_fields for each row execute procedure public.set_updated_at()';
    execute 'drop trigger if exists tba_updated_at on public.trainer_bio_answers';
    execute 'create trigger tba_updated_at before update on public.trainer_bio_answers for each row execute procedure public.set_updated_at()';
  end if;
end$$;

-- ═════════════════════════════════════════════════════════
-- 3. RLS — admin beheert template, trainer beheert eigen antwoorden,
--    publiek leest actieve velden + antwoorden van als-publiek-gemarkeerde trainers.
-- ═════════════════════════════════════════════════════════
alter table public.trainer_bio_sections enable row level security;
alter table public.trainer_bio_fields   enable row level security;
alter table public.trainer_bio_answers  enable row level security;

drop policy if exists "tbs_admin_all"  on public.trainer_bio_sections;
drop policy if exists "tbs_public_read" on public.trainer_bio_sections;
create policy "tbs_admin_all" on public.trainer_bio_sections
  for all using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));
-- Publieke read: alleen actieve secties van tenants die zelf actief zijn.
-- Tenant-scoping wordt door consumers via .eq("tenant_id", ...) afgedwongen,
-- maar we beperken hier tot actieve tenants om cross-tenant reads van
-- inactieve/verwijderde tenants te voorkomen.
create policy "tbs_public_read" on public.trainer_bio_sections
  for select using (
    is_active = true
    and exists (
      select 1 from public.tenants t
      where t.id = trainer_bio_sections.tenant_id
        and t.status = 'active'
    )
  );

drop policy if exists "tbf_admin_all"  on public.trainer_bio_fields;
drop policy if exists "tbf_public_read" on public.trainer_bio_fields;
create policy "tbf_admin_all" on public.trainer_bio_fields
  for all using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));
create policy "tbf_public_read" on public.trainer_bio_fields
  for select using (
    is_active = true
    and exists (
      select 1 from public.trainer_bio_sections s
      where s.id = trainer_bio_fields.section_id
        and s.tenant_id = trainer_bio_fields.tenant_id
        and s.is_active = true
    )
    and exists (
      select 1 from public.tenants t
      where t.id = trainer_bio_fields.tenant_id
        and t.status = 'active'
    )
  );

drop policy if exists "tba_admin_all"  on public.trainer_bio_answers;
drop policy if exists "tba_self_rw"    on public.trainer_bio_answers;
drop policy if exists "tba_public_read" on public.trainer_bio_answers;
create policy "tba_admin_all" on public.trainer_bio_answers
  for all using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));
-- Self read/write: member moet van auth.uid() zijn EN binnen dezelfde tenant
-- liggen als de answer-rij. field_id moet eveneens in dezelfde tenant zitten,
-- zodat een trainer geen cross-tenant velden of leden kan koppelen. Bovendien
-- moet de member trainer-eligible zijn (system rol 'trainer' OF tenant-rol met
-- is_trainer_role=true), zodat niet-trainers geen trainer-bio rijen kunnen
-- aanmaken.
create policy "tba_self_rw" on public.trainer_bio_answers
  for all using (
    exists (
      select 1 from public.members m
      where m.id = trainer_bio_answers.member_id
        and m.user_id = auth.uid()
        and m.tenant_id = trainer_bio_answers.tenant_id
    )
    and exists (
      select 1 from public.trainer_bio_fields f
      where f.id = trainer_bio_answers.field_id
        and f.tenant_id = trainer_bio_answers.tenant_id
    )
    and (
      exists (
        select 1 from public.member_roles mr
        where mr.member_id = trainer_bio_answers.member_id
          and mr.role = 'trainer'
      )
      or exists (
        select 1
        from public.tenant_member_roles tmr
        join public.tenant_roles tr on tr.id = tmr.role_id
        where tmr.member_id = trainer_bio_answers.member_id
          and tmr.tenant_id = trainer_bio_answers.tenant_id
          and tr.is_trainer_role = true
      )
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = trainer_bio_answers.member_id
        and m.user_id = auth.uid()
        and m.tenant_id = trainer_bio_answers.tenant_id
    )
    and exists (
      select 1 from public.trainer_bio_fields f
      where f.id = trainer_bio_answers.field_id
        and f.tenant_id = trainer_bio_answers.tenant_id
    )
    and (
      exists (
        select 1 from public.member_roles mr
        where mr.member_id = trainer_bio_answers.member_id
          and mr.role = 'trainer'
      )
      or exists (
        select 1
        from public.tenant_member_roles tmr
        join public.tenant_roles tr on tr.id = tmr.role_id
        where tmr.member_id = trainer_bio_answers.member_id
          and tmr.tenant_id = trainer_bio_answers.tenant_id
          and tr.is_trainer_role = true
      )
    )
  );
-- Publieke read: alleen antwoorden van actieve velden van als-publiek gemarkeerde
-- members, en altijd met dezelfde tenant_id binding. De member moet bovendien
-- trainer-eligible zijn (system rol 'trainer' OF tenant-rol met
-- is_trainer_role=true). Tenant moet actief zijn.
create policy "tba_public_read" on public.trainer_bio_answers
  for select using (
    exists (
      select 1 from public.members m
      where m.id = trainer_bio_answers.member_id
        and m.tenant_id = trainer_bio_answers.tenant_id
        and m.show_in_public = true
    )
    and (
      exists (
        select 1 from public.member_roles mr
        where mr.member_id = trainer_bio_answers.member_id
          and mr.role = 'trainer'
      )
      or exists (
        select 1
        from public.tenant_member_roles tmr
        join public.tenant_roles tr on tr.id = tmr.role_id
        where tmr.member_id = trainer_bio_answers.member_id
          and tmr.tenant_id = trainer_bio_answers.tenant_id
          and tr.is_trainer_role = true
      )
    )
    and exists (
      select 1 from public.trainer_bio_fields f
      join public.trainer_bio_sections s on s.id = f.section_id
      where f.id = trainer_bio_answers.field_id
        and f.tenant_id = trainer_bio_answers.tenant_id
        and f.is_active = true
        and s.is_active = true
    )
    and exists (
      select 1 from public.tenants t
      where t.id = trainer_bio_answers.tenant_id
        and t.status = 'active'
    )
  );

-- ═════════════════════════════════════════════════════════
-- 4. Lazy seed: helper-functie die per tenant de default-secties +
--    velden invoegt als er nog geen template is. Idempotent en veilig
--    om vanuit de app aan te roepen op eerste-load van de CMS pagina
--    en/of de profiel-tab.
-- ═════════════════════════════════════════════════════════
create or replace function public.seed_trainer_bio_template(target_tenant_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  has_any boolean;
  s_id uuid;
begin
  -- Sprint 30 — Tenant-access enforcement: enkel platform/tenant-admins van
  -- de doelen-tenant of de service_role mogen seeden. Voorkomt cross-tenant
  -- writes door willekeurige authenticated callers.
  if auth.role() <> 'service_role'
     and not public.has_tenant_access(target_tenant_id) then
    raise exception 'not authorized to seed trainer bio template for this tenant'
      using errcode = '42501';
  end if;

  select exists(
    select 1 from public.trainer_bio_sections where tenant_id = target_tenant_id
  ) into has_any;
  if has_any then return; end if;

  -- Sectie 1: Persoonsgegevens
  insert into public.trainer_bio_sections (tenant_id, key, label, sort_order, is_system)
    values (target_tenant_id, 'persoon', 'Persoonsgegevens', 0, true)
    returning id into s_id;
  insert into public.trainer_bio_fields (tenant_id, section_id, key, label, field_type, sort_order, is_system) values
    (target_tenant_id, s_id, 'roepnaam',     'Roepnaam',                 'short_text', 0, true),
    (target_tenant_id, s_id, 'huidige_rol',  'Huidige rol bij de club', 'short_text', 1, true),
    (target_tenant_id, s_id, 'woonplaats',   'Woonplaats',               'short_text', 2, true);

  -- Sectie 2: Achtergrond & Ervaring
  insert into public.trainer_bio_sections (tenant_id, key, label, sort_order, is_system)
    values (target_tenant_id, 'ervaring', 'Achtergrond & Ervaring', 1, true)
    returning id into s_id;
  insert into public.trainer_bio_fields (tenant_id, section_id, key, label, field_type, sort_order, is_system) values
    (target_tenant_id, s_id, 'jaren_ervaring', 'Jaren ervaring',          'number',     0, true),
    (target_tenant_id, s_id, 'speel_carriere', 'Eigen speelcarrière',     'long_text',  1, true),
    (target_tenant_id, s_id, 'eerdere_clubs',  'Eerdere clubs / teams',   'bullet_list', 2, true);

  -- Sectie 3: Opleiding & Certificaten
  insert into public.trainer_bio_sections (tenant_id, key, label, sort_order, is_system)
    values (target_tenant_id, 'opleiding', 'Opleiding & Certificaten', 2, true)
    returning id into s_id;
  insert into public.trainer_bio_fields (tenant_id, section_id, key, label, field_type, sort_order, is_system) values
    (target_tenant_id, s_id, 'diplomas',     'Diploma''s',               'bullet_list', 0, true),
    (target_tenant_id, s_id, 'cursussen',    'Cursussen / bijscholing',  'bullet_list', 1, true);

  -- Sectie 4: Specialisaties
  insert into public.trainer_bio_sections (tenant_id, key, label, sort_order, is_system)
    values (target_tenant_id, 'specialisaties', 'Specialisaties', 3, true)
    returning id into s_id;
  insert into public.trainer_bio_fields (tenant_id, section_id, key, label, field_type, sort_order, is_system) values
    (target_tenant_id, s_id, 'specialisaties', 'Specialisaties',         'bullet_list', 0, true),
    (target_tenant_id, s_id, 'doelgroepen',    'Werkt het liefst met',  'bullet_list', 1, true);

  -- Sectie 5: Waarom ik trainer ben
  insert into public.trainer_bio_sections (tenant_id, key, label, sort_order, is_system)
    values (target_tenant_id, 'motivatie', 'Waarom ik trainer ben', 4, true)
    returning id into s_id;
  insert into public.trainer_bio_fields (tenant_id, section_id, key, label, field_type, sort_order, is_system) values
    (target_tenant_id, s_id, 'motivatie', 'Mijn motivatie',           'long_text', 0, true),
    (target_tenant_id, s_id, 'visie',     'Mijn trainingsvisie',      'long_text', 1, true);
end$$;

-- Execute alleen voor service_role (server-side admin client) — onze
-- ensureTrainerBioTemplate roept dit met de service-role aan. authenticated
-- callers gebruiken de admin-server-action route, niet directe RPC.
revoke all on function public.seed_trainer_bio_template(uuid) from public;
grant execute on function public.seed_trainer_bio_template(uuid) to service_role;

-- ═════════════════════════════════════════════════════════
-- 5. Nieuwe homepage module: trainer_cards (Trainerskaartjes).
--    Bestaande 'trainers' entry blijft staan voor de korte publieke bio-tekst.
-- ═════════════════════════════════════════════════════════
insert into public.modules_catalog (key, name, description, config_schema, is_active)
values
  ('trainer_cards', 'Trainerskaartjes',
   'Kaartjes met trainersfoto, naam, leeftijd en huidige rol.',
   '{}'::jsonb, true)
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      is_active = true;
