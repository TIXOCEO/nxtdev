-- Sprint 31 — Release notes module: platform-admin beheert versies, tenant-admin
-- ziet de laatste release in de dashboard-container en het versielabel onderin.
-- Idempotent.

-- ═════════════════════════════════════════════════════════
-- 1. Tabel
-- ═════════════════════════════════════════════════════════
create table if not exists public.platform_releases (
  id            uuid primary key default gen_random_uuid(),
  version       text not null unique,
  release_type  text not null check (release_type in ('major','minor','patch')),
  title         text not null,
  summary       text not null,
  body_json     jsonb not null default '{}'::jsonb,
  status        text not null default 'draft' check (status in ('draft','published','archived')),
  published_at  timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_platform_releases_published_at
  on public.platform_releases (published_at desc nulls last)
  where status = 'published';

create index if not exists idx_platform_releases_status on public.platform_releases (status);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    execute 'drop trigger if exists platform_releases_updated_at on public.platform_releases';
    execute 'create trigger platform_releases_updated_at before update on public.platform_releases for each row execute procedure public.set_updated_at()';
  end if;
end$$;

-- ═════════════════════════════════════════════════════════
-- 2. RLS — platform-admin full access; ingelogde users zien
--    enkel gepubliceerde releases.
-- ═════════════════════════════════════════════════════════
alter table public.platform_releases enable row level security;

drop policy if exists "platform_releases_admin_all" on public.platform_releases;
create policy "platform_releases_admin_all" on public.platform_releases
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "platform_releases_authenticated_read" on public.platform_releases;
create policy "platform_releases_authenticated_read" on public.platform_releases
  for select
  using (
    auth.role() = 'authenticated'
    and status = 'published'
  );

-- ═════════════════════════════════════════════════════════
-- 3. Audit-logs: maak tenant_id nullable zodat platform-niveau acties
--    (zoals release-notes beheer) ook een audit-trail krijgen. Pas de
--    select-policy aan zodat platform-admins de tenant-loze rijen zien.
-- ═════════════════════════════════════════════════════════
alter table public.audit_logs alter column tenant_id drop not null;

drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs
  for select
  using (
    (tenant_id is not null and public.has_tenant_access(tenant_id))
    or (tenant_id is null and public.is_platform_admin())
  );

-- ═════════════════════════════════════════════════════════
-- 4. Retroactieve seed (idempotent op `version`).
--    Body-secties: { new[], improved[], fixed[], admin[] } — allemaal
--    optioneel, maar in deze volgorde gerenderd in de UI.
-- ═════════════════════════════════════════════════════════
insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values
  ('0.1.0', 'minor',
   'Eerste publieke tenant-pagina''s & basis-CMS',
   'Tenant-specifieke landingspagina, nieuwsmodule en eigen branding live.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Publieke tenant-homepage met logo, kleur en contactgegevens',
       'Nieuwsmodule met categorieën en gepubliceerde berichten',
       'Basis-CMS voor tekstpagina''s per tenant'
     ),
     'improved', jsonb_build_array('Branding-tokens (kleur + logo) gedeeld door publieke pagina''s')
   ),
   'published', '2025-06-12 10:00:00+00'),

  ('0.2.0', 'minor',
   'Registraties, proeflessen & onboarding-basis',
   'Ouders kunnen kinderen aanmelden, proeflessen aanvragen, en nieuwe tenants kunnen worden onboarded.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Publiek registratieformulier voor ouders met kindgegevens',
       'Aanvraagstroom voor proeflessen',
       'Eerste versie van de tenant-onboarding flow'
     )
   ),
   'published', '2025-07-08 10:00:00+00'),

  ('0.3.0', 'minor',
   'Ledenadministratie & groepen',
   'Tenant-admins beheren leden en groepen vanuit één centraal scherm.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Ledenoverzicht met filters en zoek',
       'Groepenbeheer met indeling van leden',
       'Koppeling van rollen aan groepen'
     ),
     'admin', jsonb_build_array('Members-tabel is vanaf nu de canonieke entiteit voor personen.')
   ),
   'published', '2025-08-04 10:00:00+00'),

  ('0.3.1', 'patch',
   'Sneller ledenoverzicht',
   'Filters en zoek op het ledenoverzicht laden merkbaar sneller.',
   jsonb_build_object('improved', jsonb_build_array('Indexen toegevoegd op leden-zoekvelden')),
   'published', '2025-08-15 09:00:00+00'),

  ('0.4.0', 'minor',
   'Homepage-builder met modulair grid',
   'Bouw een eigen tenant-homepage met sleep-en-neerzet modules.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Modulair grid voor de tenant-homepage',
       'Modules voor nieuws, slider, sponsors en tekstblokken',
       'Live-voorbeeld van wijzigingen'
     )
   ),
   'published', '2025-09-02 10:00:00+00'),

  ('0.4.1', 'patch',
   'Homepage drag-and-drop fix',
   'Modules verspringen niet meer bij het verslepen op kleine schermen.',
   jsonb_build_object('fixed', jsonb_build_array('Drag-and-drop op tablets stabiel gemaakt')),
   'published', '2025-09-16 09:00:00+00'),

  ('0.5.0', 'minor',
   'Communicatie: nieuwsbrieven, e-mail-templates, notificaties',
   'Eén communicatiehub voor uitgaande berichten, met per-tenant templates en in-app notificaties.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Nieuwsbrieven samenstellen en versturen',
       'Bewerkbare e-mail-templates per tenant',
       'In-app notificatiecentrum voor leden'
     ),
     'admin', jsonb_build_array('Per-tenant sender-domein gebruikt voor uitgaande mail.')
   ),
   'published', '2025-09-30 10:00:00+00'),

  ('0.6.0', 'minor',
   'Memberships & betaalstromen v1',
   'Lidmaatschapsplannen, koppelen aan leden en eerste betaallog.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Beheer van lidmaatschapsplannen per tenant',
       'Lid → membership-koppeling met startdatum',
       'Eerste betaallog per membership'
     )
   ),
   'published', '2025-10-21 10:00:00+00'),

  ('0.6.2', 'patch',
   'Betaallog tijdzone-fix',
   'Betaaldatums tonen nu consistent in de tenant-tijdzone.',
   jsonb_build_object('fixed', jsonb_build_array('Tijdzone-conversie in betaaloverzicht hersteld')),
   'published', '2025-11-05 09:00:00+00'),

  ('0.7.0', 'minor',
   'Audit-logging & platform-admin tooling',
   'Belangrijke acties worden vastgelegd; platform-admins krijgen meer beheers-tools.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Audit-log per tenant met filter op actie en gebruiker',
       'Platform-admin tooling voor tenant-status en master-admin'
     ),
     'admin', jsonb_build_array('Audit-events worden lazy weggeschreven; oude events kunnen worden opgeschoond.')
   ),
   'published', '2025-11-18 10:00:00+00'),

  ('0.8.0', 'minor',
   'Moderatie, social feed, sponsors & mediawall',
   'Sociale interactie en uitstraling: feed, moderatie, sponsoren en een mediawall.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Social feed met posts en reacties',
       'Moderatie-tools voor tenant-admins',
       'Sponsorenmodule en publieke mediawall'
     )
   ),
   'published', '2026-01-13 10:00:00+00'),

  ('0.8.1', 'patch',
   'Sponsorlogo''s scherper',
   'Sponsorlogo''s worden nu in de juiste resolutie getoond op retina-schermen.',
   jsonb_build_object('improved', jsonb_build_array('Hogere DPR voor sponsorlogo-rendering')),
   'published', '2026-02-03 09:00:00+00'),

  ('0.9.0', 'minor',
   'Trainersbio''s, payments v2 & RLS-migratie',
   'Trainerskaartjes met eigen bio, betalingen v2 met defaults en partials, en breder RLS-pad voor admin-acties.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Tenant-CMS voor trainersbio formulier',
       'Publieke trainerskaartjes module op de homepage',
       'Payments v2: standaard-plan, partials, refunds en cancel'
     ),
     'improved', jsonb_build_array(
       'Ledenadministratie UX-refresh',
       'Strengere validatie op betaalbedragen'
     ),
     'fixed', jsonb_build_array('Homepage-layout schrijfacties geserialiseerd per tenant'),
     'admin', jsonb_build_array(
       'Eerste tenant-admin acties draaien onder RLS i.p.v. service-role',
       'Nieuwe migraties moeten in volgorde toegepast worden — zie replit.md Gotchas.'
     )
   ),
   'published', '2026-04-22 10:00:00+00')
on conflict (version) do nothing;
