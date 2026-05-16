-- Sprint 66 release notes — v0.22.0 (form-builder UI).
insert into public.platform_releases (
  version, release_type, title, summary, body_json, status, published_at
) values (
  '0.22.0',
  'minor',
  'Visuele bouwer voor eigen aanmeldformulieren',
  'Tenant-admins kunnen voortaan zelf intake-formulieren ontwerpen met een drag-drop builder, met validatie voordat ze gepubliceerd worden.',
  jsonb_build_object(
    'nieuw', jsonb_build_array(
      'Nieuwe sectie /tenant/intake/forms met lijst, detail en drag-drop builder voor intake-formulieren.',
      'Live preview tijdens het bouwen — admins zien direct hoe het formulier eruit komt te zien.',
      'Importeer sector-template als startpunt zodat je niet vanaf nul hoeft te beginnen.',
      'Optionele deeplink ?form=<slug> op de inschrijfpagina zodat verschillende kanalen verschillende formulieren kunnen tonen.'
    ),
    'verbeterd', jsonb_build_array(
      'Publiceer-knop is pas actief wanneer het formulier alle validaties doorstaat (min. 1 veld, geldige show-if-verwijzingen, opties voor keuzelijsten, geldige patronen).',
      'Database-trigger weigert publicatie van ongeldige formulieren als extra vangnet, ook bij directe SQL-aanpassingen.'
    ),
    'opgelost', jsonb_build_array(
      'Cyclische show-if-verwijzingen worden bij publicatie gedetecteerd en geblokkeerd.'
    ),
    'voor_admins', jsonb_build_array(
      'Nieuwe RPC validate_intake_form(uuid) returnt (is_valid bool, errors jsonb) — kan ook handmatig vanuit SQL aangeroepen worden voor debugging.',
      'Form-builder is alleen zichtbaar wanneer tenants.settings_json.dynamic_intake_enabled=true; Houtrust blijft op de legacy tryout-flow.',
      'Audit-namespace intake.form.* voor alle CRUD-acties op formulieren en velden.'
    )
  ),
  'published',
  now()
)
on conflict (version) do nothing;

-- Einde sprint66_release_v0_22_0.sql.
