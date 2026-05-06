-- Sprint 34 — Publiceer release v0.10.0 in `platform_releases`.
-- Idempotent op `version` (insert ... on conflict do nothing).
-- Bevat samengevatte changelog van Task #36 t/m #49.

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values
  ('0.10.0', 'minor',
   'Trainersbio, slimmere betalingen, ledenadministratie 2.0 en het nieuwe releasesysteem',
   'Grote update: trainersprofielen op de homepage, uitgebreide betalingsmodule, een volledig vernieuwde leden-administratie met tabs en filters, en jullie zien dit bericht dankzij het nieuwe releasesysteem dat platform-admins gebruiken om updates te delen.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Releasesysteem: dashboard-blok met laatste update, archief op /tenant/releases, deelbare detailpagina''s en automatische in-app notificatie bij elke nieuwe release.',
       'Ongelezen-indicator: rode "Nieuw"-badge op de dashboard-container en een rode dot bij het versielabel zolang je een release nog niet hebt geopend.',
       'Trainersbio: trainers vullen hun publieke profiel in met foto en biografie; tenant-admins beheren een sjabloon met secties en velden; trainerkaarten verschijnen op de homepage.',
       'Betalingen v2: standaard-abonnement en standaard-betaalmethode per tenant, status partial/overdue/refunded/waived, betalingen kunnen worden beëindigd met reden.',
       'Leden-administratie: tab-shell op het leddetail (Overzicht / Persoonlijk / Sport / Familie / Abonnement & Betalingen / Communicatie / Logboek), multi-rol chips, paginatie 25/50/100, filter-sheet en actieve filterchips.',
       'Snelle ledenzoek op naam of e-mailadres in de filterbalk én in CSV-export.',
       'Audit-log filter op actor (e-mail) en lid (naam), inclusief in de CSV-export.',
       'Tenant-admins stellen zelf de bewaartermijn van het audit-log in (12 / 24 / 36 / 60 maanden, "nooit opschonen" of een aangepaste waarde).',
       'Homepage-modules: nieuwsslider met vaste hoogte, Google Maps en image-slider als nieuwe blokken.'
     ),
     'improved', jsonb_build_array(
       'Wisselen tussen tabs is volledig stabiel (geen spring/jump) op zowel publiek profiel als admin-detail.',
       'Ledenaantal staat naast de filterbalk zodat je in één oogopslag ziet hoeveel leden binnen je filter vallen.',
       'Homepage layout-mutaties zijn nu race-vrij: twee admins kunnen tegelijk modules toevoegen zonder dat ze in hetzelfde slot belanden.',
       'Veel tenant-admin acties leunen nu op database-rules (RLS) in plaats van de service-role; sneller falen bij ongeautoriseerde toegang.'
     ),
     'fixed', jsonb_build_array(
       'Homepage modules formaat-bug: blokken behouden hun gekozen formaat na een refresh.',
       'Filtercombinaties op de ledenlijst tellen correct door in paginatie en CSV-export.'
     ),
     'admin', jsonb_build_array(
       'SQL-migraties die deze release vereist (in deze volgorde): sprint29_homepage_modules_v2.sql, sprint30_trainer_bio.sql, sprint30_payments_v2.sql, sprint30_homepage_layout_locks.sql, sprint31_release_notes.sql, sprint32_release_notifications.sql, sprint33_release_reads.sql, sprint34_release_v0_10_0.sql.',
       'E-mailmeldingen bij een nieuwe release zijn opt-in per tenant via notification_events (event_key=platform_release_published, email_enabled=true) en respecteren per-user opt-outs in notification_prefs.',
       'Audit-log accepteert vanaf nu tenant-loze rijen voor platform-niveau acties (release-beheer); RLS is bijgewerkt zodat alleen platform-admins die rijen zien.'
     )
   ),
   'published', now())
on conflict (version) do nothing;
