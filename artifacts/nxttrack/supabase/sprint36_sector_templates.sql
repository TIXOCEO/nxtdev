-- ──────────────────────────────────────────────────────────
-- Sprint 36 — Sector templates & tenant terminology
--
-- Voorbereiding op multi-sector NXTTRACK. Voegt één tabel
-- `sector_templates` toe met drie geseede templates en koppelt
-- tenants via een nullable `sector_template_key`. Per-tenant
-- terminologie-overrides leven in de bestaande
-- `tenants.settings_json` onder de sub-key `terminology_overrides`
-- — geen extra kolom op `tenants`.
--
-- Volledig idempotent. Voetbalschool Houtrust wordt gebackfilled
-- naar `football_school` zodat de UI tekstueel exact hetzelfde
-- blijft.
-- ──────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════
-- 1. sector_templates
-- ═════════════════════════════════════════════════════════
create table if not exists public.sector_templates (
  key                  text primary key,
  name                 text not null,
  description          text,
  terminology_json     jsonb not null default '{}'::jsonb,
  default_modules_json jsonb not null default '[]'::jsonb,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at' and pronamespace = 'public'::regnamespace) then
    execute 'drop trigger if exists sector_templates_updated_at on public.sector_templates';
    execute 'create trigger sector_templates_updated_at before update on public.sector_templates for each row execute procedure public.set_updated_at()';
  end if;
end $$;

alter table public.sector_templates enable row level security;

-- Iedere ingelogde gebruiker mag templates lezen (voor de UI-resolver).
drop policy if exists "sector_templates_authenticated_read" on public.sector_templates;
create policy "sector_templates_authenticated_read" on public.sector_templates
  for select using (auth.role() = 'authenticated');

-- Alleen platform-admins mogen schrijven.
drop policy if exists "sector_templates_admin_all" on public.sector_templates;
create policy "sector_templates_admin_all" on public.sector_templates
  for all
  using      (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ═════════════════════════════════════════════════════════
-- 2. Seed: football_school / swimming_school / generic
--    `on conflict (key) do nothing` zorgt voor idempotency —
--    bestaande overrides door platform-admins blijven staan.
-- ═════════════════════════════════════════════════════════
insert into public.sector_templates (key, name, description, terminology_json)
values
  ('football_school',
   'Voetbalschool',
   'Standaardtermen voor voetbalverenigingen en voetbalscholen.',
   jsonb_build_object(
     'member_singular',       'Lid',
     'member_plural',         'Leden',
     'participant_singular',  'Sporter',
     'participant_plural',    'Sporters',
     'guardian_singular',     'Ouder',
     'guardian_plural',       'Ouders',
     'instructor_singular',   'Trainer',
     'instructor_plural',     'Trainers',
     'group_singular',        'Groep',
     'group_plural',          'Groepen',
     'session_singular',      'Training',
     'session_plural',        'Trainingen',
     'program_singular',      'Lidmaatschap',
     'program_plural',        'Lidmaatschappen',
     'attendance_label',      'Aanwezigheid',
     'registration_singular', 'Inschrijving',
     'registration_plural',   'Inschrijvingen',
     'certificate_singular',  'Certificaat',
     'certificate_plural',    'Certificaten'
   )),
  ('swimming_school',
   'Zwemschool',
   'Standaardtermen voor zwemscholen en zwemverenigingen.',
   jsonb_build_object(
     'member_singular',       'Lid',
     'member_plural',         'Leden',
     'participant_singular',  'Leerling',
     'participant_plural',    'Leerlingen',
     'guardian_singular',     'Ouder/verzorger',
     'guardian_plural',       'Ouders/verzorgers',
     'instructor_singular',   'Zweminstructeur',
     'instructor_plural',     'Zweminstructeurs',
     'group_singular',        'Lesgroep',
     'group_plural',          'Lesgroepen',
     'session_singular',      'Zwemles',
     'session_plural',        'Zwemlessen',
     'program_singular',      'Lespakket',
     'program_plural',        'Lespakketten',
     'attendance_label',      'Lesaanwezigheid',
     'registration_singular', 'Aanmelding',
     'registration_plural',   'Aanmeldingen',
     'certificate_singular',  'Zwemdiploma',
     'certificate_plural',    'Zwemdiploma''s'
   )),
  ('generic',
   'Generiek',
   'Sector-neutrale termen voor academies waarvoor geen specifieke template past.',
   jsonb_build_object(
     'member_singular',       'Lid',
     'member_plural',         'Leden',
     'participant_singular',  'Deelnemer',
     'participant_plural',    'Deelnemers',
     'guardian_singular',     'Ouder/verzorger',
     'guardian_plural',       'Ouders/verzorgers',
     'instructor_singular',   'Begeleider',
     'instructor_plural',     'Begeleiders',
     'group_singular',        'Groep',
     'group_plural',          'Groepen',
     'session_singular',      'Sessie',
     'session_plural',        'Sessies',
     'program_singular',      'Programma',
     'program_plural',        'Programma''s',
     'attendance_label',      'Aanwezigheid',
     'registration_singular', 'Aanmelding',
     'registration_plural',   'Aanmeldingen',
     'certificate_singular',  'Certificaat',
     'certificate_plural',    'Certificaten'
   ))
on conflict (key) do nothing;

-- ═════════════════════════════════════════════════════════
-- 3. tenants.sector_template_key (nullable, FK)
-- ═════════════════════════════════════════════════════════
alter table public.tenants
  add column if not exists sector_template_key text;

-- FK apart toevoegen zodat herloop werkt.
alter table public.tenants
  drop constraint if exists tenants_sector_template_key_fk;
alter table public.tenants
  add constraint tenants_sector_template_key_fk
  foreign key (sector_template_key)
  references public.sector_templates(key)
  on delete set null;

create index if not exists tenants_sector_template_key_idx
  on public.tenants (sector_template_key);

-- ═════════════════════════════════════════════════════════
-- 4. Backfill: bestaande tenants → 'football_school'
--    Idempotent: alleen tenants zonder template krijgen er één.
--    Hierdoor blijft de UI voor Voetbalschool Houtrust en alle
--    overige bestaande tenants tekstueel exact hetzelfde.
-- ═════════════════════════════════════════════════════════
update public.tenants
   set sector_template_key = 'football_school'
 where sector_template_key is null;

-- Einde sprint36.
