-- ──────────────────────────────────────────────────────────
-- Sprint 37 — Sector-aware volzin-strings (page descriptions,
-- knop-teksten, dashboard hints) en consolidatie van de
-- memberships-page-titel.
--
-- Voortbouwend op sprint36_sector_templates.sql:
--   * voegt 9 nieuwe volzin-keys toe aan de drie geseede templates
--     (`football_school`, `swimming_school`, `generic`) via een
--     idempotente jsonb-merge — bestaande overrides door
--     platform-admins blijven behouden voor andere keys;
--   * verwijdert de losstaande `program_page_title`-key (de page-title
--     van /tenant/memberships gebruikt vanaf nu `program_plural`,
--     waardoor sidebar-label en page-title gegarandeerd één bron
--     hebben);
--   * past Houtrust' `program_plural` niet aan: blijft "Lidmaatschappen"
--     zoals de sidebar al toonde — page-title wisselt daarmee bewust
--     van "Abonnementen" naar "Lidmaatschappen" (zie release-notes).
--
-- Volledig idempotent: meerdere uitvoeringen produceren hetzelfde
-- eindresultaat.
-- ──────────────────────────────────────────────────────────

-- football_school: hou bewust dezelfde wording aan als de huidige
-- hardcoded NL-strings van Houtrust om visuele regressie te minimaliseren.
update public.sector_templates
   set terminology_json = (terminology_json - 'program_page_title')
                        || jsonb_build_object(
       'members_page_description',
         'Beheer ouders, sporters, trainers en staf van deze vereniging.',
       'groups_page_description',
         'Maak teams of trainingsgroepen aan en koppel leden eraan.',
       'groups_new_form_title',        'Nieuwe groep',
       'trainings_page_description',
         'Plan trainingen voor groepen, beheer status en aanwezigheid.',
       'trainings_new_button',         'Nieuwe training',
       'memberships_page_description',
         'Definieer lidmaatschappen voor deze vereniging.',
       'memberships_new_form_title',   'Nieuw lidmaatschap',
       'dashboard_participants_hint',  'Beheer sporters en teams.',
       'dashboard_instructors_hint',   'Trainersbestand en koppelingen.'
     )
 where key = 'football_school';

-- swimming_school
update public.sector_templates
   set terminology_json = (terminology_json - 'program_page_title')
                        || jsonb_build_object(
       'members_page_description',
         'Beheer ouders, leerlingen, instructeurs en staf van deze zwemschool.',
       'groups_page_description',
         'Maak lesgroepen aan en koppel leerlingen eraan.',
       'groups_new_form_title',        'Nieuwe lesgroep',
       'trainings_page_description',
         'Plan zwemlessen voor lesgroepen, beheer status en lesaanwezigheid.',
       'trainings_new_button',         'Nieuwe zwemles',
       'memberships_page_description',
         'Definieer lespakketten voor deze zwemschool.',
       'memberships_new_form_title',   'Nieuw lespakket',
       'dashboard_participants_hint',  'Beheer leerlingen en lesgroepen.',
       'dashboard_instructors_hint',   'Instructeursbestand en koppelingen.'
     )
 where key = 'swimming_school';

-- generic
update public.sector_templates
   set terminology_json = (terminology_json - 'program_page_title')
                        || jsonb_build_object(
       'members_page_description',
         'Beheer ouders, deelnemers, begeleiders en staf van deze academie.',
       'groups_page_description',
         'Maak groepen aan en koppel deelnemers eraan.',
       'groups_new_form_title',        'Nieuwe groep',
       'trainings_page_description',
         'Plan sessies voor groepen, beheer status en aanwezigheid.',
       'trainings_new_button',         'Nieuwe sessie',
       'memberships_page_description',
         'Definieer programma''s voor deze academie.',
       'memberships_new_form_title',   'Nieuw programma',
       'dashboard_participants_hint',  'Beheer deelnemers en groepen.',
       'dashboard_instructors_hint',   'Begeleidersbestand en koppelingen.'
     )
 where key = 'generic';

-- Strip eventuele per-tenant overrides van de inmiddels verwijderde key
-- zodat de Zod-strip niet onnodig parse-werk doet bij elke render.
update public.tenants
   set settings_json = jsonb_set(
         settings_json,
         '{terminology_overrides}',
         (settings_json -> 'terminology_overrides') - 'program_page_title',
         false
       )
 where settings_json ? 'terminology_overrides'
   and (settings_json -> 'terminology_overrides') ? 'program_page_title';

-- Einde sprint37.
