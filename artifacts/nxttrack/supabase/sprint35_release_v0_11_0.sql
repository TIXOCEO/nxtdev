-- Sprint 35 — Publiceer release v0.11.0 in `platform_releases`.
-- Idempotent op `version` (insert ... on conflict do nothing).
-- Bevat de changelog van Task #50 t/m #55 (Aanwezigheid v2).

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values
  ('0.11.0', 'minor',
   'Aanwezigheid 2.0 — auto-herinneringen, trainer-shell en mini leerlingdossier',
   'De aanwezigheidsmodule is opnieuw opgebouwd rond de trainer in het veld. Trainers krijgen nu hun eigen agenda en een mobile-first "Manage training"-scherm waarop ze met één tik per lid de aanwezigheid markeren. Leden ontvangen automatisch een herinnering ruim voor de start, en trainers houden korte observaties bij in een nieuw mini leerlingdossier.',
   jsonb_build_object(
     'new', jsonb_build_array(
       'Auto-herinneringen: een uur-cron stuurt automatisch een herinnering uit op basis van de instelling "uren voor start". Eenmaal per training, zonder dubbele meldingen.',
       'Trainer-agenda in de gewone gebruikers-shell: trainers zien hun trainingen onder /t/[slug]/schedule met een "Trainer"-badge — geen aparte tenant-admin omgeving meer nodig.',
       'Mobile-first "Manage training"-scherm voor trainers met sticky header, "markeer alle aanwezig" in één tik, snelle aanwezigheidsknoppen per lid en een bottom-sheet voor reden/notitie.',
       'Notitie per aanwezigheidsregel met zichtbaarheid: privé voor trainers of zichtbaar voor het lid/de ouder.',
       'Mini leerlingdossier (LVS) onder /t/[slug]/members/[id] dat alleen voor trainers van dat lid zichtbaar is, met chronologische observaties en een nieuwe-notitie-formulier (privé of zichtbaar voor lid).',
       'Doorklik vanaf het manage-scherm naar het leerlingdossier voorvult de notitie met de juiste training-context.'
     ),
     'improved', jsonb_build_array(
       'Late RSVP-meldingen gaan nu alleen naar trainers van de specifieke groep in plaats van alle trainers van de academie.',
       'Wanneer een lid wordt toegevoegd aan een groep, worden direct aanwezigheidsregels aangemaakt voor alle al geplande toekomstige trainingen — het lid verschijnt meteen op de manage-lijst en in de eigen agenda.',
       'Het ophalen van trainingen voor de eigen agenda is sneller en respecteert vanaf nu een datum-venster en een limiet, ook voor trainers van grote groepen.'
     ),
     'fixed', jsonb_build_array(
       'Trainers met een tenant-eigen rol (`is_trainer_role`) worden in alle aanwezigheidsschermen consequent als trainer herkend.'
     ),
     'admin', jsonb_build_array(
       'SQL-migraties die deze release vereist (in deze volgorde): sprint35_attendance_auto_reminder.sql, sprint35_attendance_note_visibility.sql, sprint35_member_observations.sql, sprint35_release_v0_11_0.sql.',
       'Cron-endpoint POST /api/cron/training-reminders is beveiligd met header `x-cron-secret`; zet de env var `CRON_SECRET` in productie en geef dezelfde waarde aan de api-server mee zodat de uur-tick door de poort komt. GET op deze route is bewust uitgeschakeld.',
       'Optionele api-server env vars: `TRAINING_REMINDER_URL` (default: http://localhost/api/cron/training-reminders) en `TRAINING_REMINDER_INTERVAL_MS` (default: 3600000).',
       'De oude kolommen `training_attendance.notes` en `training_attendance.trainer_note` blijven nog één release in sync met de nieuwe `note` + `note_visibility`, voor rollback-veiligheid; ze mogen pas in de release daarna verwijderd worden.'
     )
   ),
   'published', now())
on conflict (version) do nothing;
