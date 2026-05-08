-- ──────────────────────────────────────────────────────────
-- Sprint 54 — Release notes v0.14.0 (Zwemschool-fundament)
--
-- Idempotent: insert ... on conflict (version) do nothing.
-- Status `published` zodat tenant-admins de release direct in hun
-- inbox + sidebar zien (Sprint 32-33 mechaniek).
-- ──────────────────────────────────────────────────────────

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values (
  '0.14.0',
  'minor',
  'Zwemschool-modules: wachtlijst, voortgang, inhaallessen, capaciteit en diploma-events',
  'Een groot fundament voor zwemscholen — en bruikbaar voor elke academie die met wachtlijsten, positieve voortgang en momenten van afzwemmen werkt. Plus: kies of nieuwe aanmeldingen meteen op de wachtlijst landen, en hoe leerlingen hun voortgang zien (tekst, sterren of emoji).',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Wachtlijst: nieuwe tabellen voor wachtlijst-aanvragen en aanbiedingen, inclusief decision-tokens en audit-historie.',
      'Voortgang: bouw je eigen voortgangsboom (module → categorie → onderdeel) met optionele beschrijving en uitlegvideo per onderdeel.',
      'Voortgang-weergave: kies per academie tussen tekst, sterren (1-5) of emoji als label-stijl. Schermlezers blijven het tekstuele label horen.',
      'Aanmeld-routing: tenant-admin bepaalt of een nieuwe aanmelding default als inschrijving of als wachtlijst-plaatsing binnenkomt — het bestaande publieke formulier blijft de enige ingang.',
      'Inhaallessen: credits en verzoeken om een gemiste les in te halen, met goedkeuringspad voor de tenant-admin.',
      'Capaciteit: definieer locaties, baden, banen, velden — en koppel ze aan trainingssessies met een max-aantal deelnemers.',
      'Mijlpalen + diploma-events: definieer drempels per voortgangsmodule, plan afzwemmomenten, nodig leerlingen uit en geef certificaten uit.'
    ),
    'improved', jsonb_build_array(
      'Notificatie-deduplicatie uitgebreid met de nieuwe events (wachtlijst, inhaal, mijlpaal-event, certificaat) volgens hetzelfde patroon als Sprint 41/43.',
      'Sector-terminologie aangevuld met wachtlijst-, inhaal-, mijlpaal- en capaciteit-termen voor de drie geseede sectoren (generic / football_school / swimming_school).'
    ),
    'fixed', jsonb_build_array(
      'Geen Houtrust-regressie: alle bestaande tenants krijgen expliciet `intake_default = registration` en `progress_render_style = text`.'
    ),
    'admin', jsonb_build_array(
      'Migratievolgorde productie: sprint47 → sprint48 → sprint49 → sprint50 → sprint51 → sprint52 → sprint53 → sprint54.',
      'Tenant-instellingen leven onder `tenants.settings_json`: `intake_default` (registration|waitlist), optioneel `intake_overrides_by_target`, en `progress_render_style` (text|stars|emoji).',
      'Scoring-labels hebben optionele kolommen `emoji` en `star_value` (1-5); validatie vindt plaats in de tenant-admin UI op basis van `progress_render_style`.',
      'Positieve scoring is DB-enforced: `scoring_labels.is_positive_outcome` heeft een check `= true`; afkeurende labels zijn niet mogelijk.',
      'Examinator-flag op tenant_roles: nieuwe boolean `is_examiner_role` (analoog aan `is_trainer_role`).',
      'Voortgangstemplate per sector: `sector_templates.progress_template_json` (alleen swimming_school is geseed; football_school en generic blijven leeg).'
    )
  ),
  'published',
  now()
)
on conflict (version) do nothing;
