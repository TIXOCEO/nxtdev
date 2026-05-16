-- ═════════════════════════════════════════════════════════════════
-- Sprint 65 — Release notes v0.21.0 (Dynamic intake foundation MVP).
-- Idempotent: insert ... on conflict do nothing op (version).
-- ═════════════════════════════════════════════════════════════════

insert into public.platform_releases
  (version, release_type, title, summary, body_json, status, published_at)
values (
  '0.21.0',
  'minor',
  'Dynamische aanmeldformulieren — fundering',
  'Eerste implementatie-sprint van het dynamische aanmeldsysteem. Tenants kunnen via een nieuwe feature-flag (`dynamic_intake_enabled`) over op het generieke aanmeldfundament: dynamische formulier-renderer, één centrale inzendingen-tabel en een nieuwe admin-lijst onder /tenant/intake. Houtrust en alle bestaande tenants zien geen verandering omdat de flag standaard uit staat.',
  jsonb_build_object(
    'nieuw', jsonb_build_array(
      'Nieuwe pagina /tenant/intake met overzicht van alle inzendingen (filters op status, programma, type en datum).',
      'Dynamisch proefles-formulier voor tenants met dynamic_intake_enabled = true; configuratie volgt uit ingebouwde sector-defaults.',
      'Sector-defaults voor voetbalschool, zwemschool en generiek bieden direct werkbare formulieren zonder configuratie.'
    ),
    'verbeterd', jsonb_build_array(
      'Inzendingen worden centraal opgeslagen in intake_submissions met genormaliseerde antwoorden — basis voor toekomstige plaatsings- en wachtlijst-uitbreidingen.',
      'Bij flag-on schrijft het tryout-formulier zowel naar intake_submissions als (best-effort) naar de bestaande registrations-tabel zodat huidige workflows blijven werken.'
    ),
    'opgelost', jsonb_build_array(
      'Notificatie-deduplicatie uitgebreid met intake_submission_created (drop+recreate-patroon, identiek aan eerdere sprints).'
    ),
    'voor_admins', jsonb_build_array(
      'Feature-flag tenants.settings_json.dynamic_intake_enabled (boolean, default false) bepaalt of de dynamische renderer aan staat — Houtrust blijft op false.',
      'Nieuwe audit-namespace intake.* (intake.submission.created, intake.submission.status_changed, intake.submission.placed).',
      'Nieuwe e-mailtemplate-key intake_submitted wordt lazy-geseed op eerste gebruik per tenant.'
    )
  ),
  'published',
  now()
)
on conflict (version) do nothing;

-- Einde sprint65_release_v0_21_0.sql.
