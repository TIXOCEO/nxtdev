-- Sprint 39 — Publiceer release v0.12.0 in `platform_releases`.
-- Idempotent op `version` (insert ... on conflict do nothing).
-- Bevat samengevatte changelog van Task #54 + #56 t/m #61 (sector templates,
-- terminologie-laag, sector-aware rollen/notificaties en kleine UX-finishing).

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values
  ('0.12.0', 'minor',
   'Multi-sector fundament — eigen woordenschat per academie',
   'NXTTRACK is voorbereid op meerdere sporten. Achter de schermen werkt het platform nu met sector-templates (voetbalschool, zwemschool, generiek) en een centrale terminologie-laag. Sidebar, paginatitels, knop-teksten, dashboard-hints, rollen en e-mailonderwerpen passen zich automatisch aan de sector aan. Tenant-admins kunnen daarbovenop hun eigen woordenschat fijnstemmen.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Sector-templates: nieuwe sjablonen voor voetbalschool, zwemschool en generiek. Bestaande academies zijn automatisch gekoppeld aan voetbalschool — er verandert tekstueel niets voor jullie leden.',
       'Centrale terminologie-laag: sidebar-labels, pagina-koppen, formulier-titels, knop-teksten en dashboard-hints worden voortaan uit één plek geserveerd, met fallback per-tenant override → sector → generiek.',
       'Tenant-admins kunnen op `/tenant/profile` zelf de woordenschat fijnstemmen via het blok "Sector & woordenschat" — met live "→ effectief"-preview en wis-knop. Mutaties komen in het audit-log.',
       'Sector-aware rollen: lid/ouder/trainer-labels op de ledenlijst worden uit terminology gehaald (b.v. "Sporter / Voogd / Instructeur" voor zwemschool).',
       'Sector-aware e-mailonderwerpen voor training-notificaties (`training_*`, `trainer_attendance_updated`, `social_training_recap`).',
       'Platform-admin scherm `/platform/sector-templates` om templates te beheren, plus tenant-impact (welke tenants gebruiken deze template) en een bevestigings-dialoog bij verwijderen — met fallback naar generiek.',
       '"Nieuw"-badge per release op het tenant-archief `/tenant/releases`, zodat ongelezen versies meteen opvallen.'
     ),
     'improved', jsonb_build_array(
       'Het dashboard-blok "Coming soon" gebruikt vanaf nu Nederlandse termen ("Sporters" / "Trainers") in plaats van Engelse plaatsteksten.',
       'Pagina-titel van de abonnementen-pagina is geconsolideerd met de sidebar en heet nu "Lidmaatschappen" (was "Abonnementen") — één term, op één plek.',
       'Het veld "type sporter" op een lid is niet langer hardcoded vastgepind op voetbal-waardes; per sector kunnen later eigen subtypes komen (huidige voetbal-UI blijft werken).'
     ),
     'fixed', jsonb_build_array(
       'Tenant-admins die alleen kleine label-tweaks wilden, hoeven niet meer op een platform-admin te wachten — overrides werken meteen.'
     ),
     'admin', jsonb_build_array(
       'SQL-migraties die deze release vereist (in deze volgorde, allemaal idempotent): sprint36_sector_templates.sql, sprint37_sector_template_sentences.sql, sprint38_player_type_open.sql, sprint39_release_v0_12_0.sql.',
       'Sector-template keuze per tenant blijft een platform-admin-beslissing en gebeurt op `/platform/tenants/[id]` (sectie "Sector & woordenschat"). Tenant-admins zien dezelfde sectie read-only op `/tenant/profile` en kunnen daar wel hun eigen overrides bewerken.',
       'Geen nieuwe environment variables in deze release.',
       'De legacy aanwezigheidskolommen `training_attendance.notes` en `training_attendance.trainer_note` (uit v0.11) blijven nog steeds in sync met `note` + `note_visibility`; ze mogen pas in een volgende release worden verwijderd.'
     )
   ),
   'published', now())
on conflict (version) do nothing;
