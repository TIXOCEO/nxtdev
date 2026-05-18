-- ============================================================================
-- Sprint 82d release notes — v0.40.1
-- ============================================================================
-- Patch-release: admin kan vanuit de intake-detailpagina direct 3 voorstellen
-- e-mailen naar de aanvrager. Sluit task #145 die in v0.40.0 nog open stond.
-- ============================================================================

set search_path = public;

insert into public.platform_releases (
  version, release_type, published_at, title, summary, body_json, status
) values (
  '0.40.1',
  'patch',
  now(),
  'Stuur intake-voorstellen direct vanuit het admin-paneel',
  'Tenant-admins kunnen vanaf de intake-detailpagina met één klik een mail naar de aanvrager sturen met 3 voorstellen. De aanvrager komt via een tijdelijke link (7 dagen geldig) direct op de "Kies je tijdsblok"-pagina.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Knop "Stuur 3 voorstellen aan aanvrager" op de intake-detailpagina — verstuurt een mail met deep-link naar /inschrijven/voorstellen.',
      'Nieuwe e-mail-template "Intake — voorstellen-link" (aanpasbaar onder /tenant/email).'
    ),
    'improved', jsonb_build_array(
      'Admin-actie werkt ook wanneer de publieke voorstellen-flag uit staat — de link geeft de aanvrager altijd toegang via zijn eigen review-token.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'Audit-event intake.review_link_sent registreert wanneer en door wie de voorstellen-mail is verstuurd.',
      'Bij elke nieuwe verzending wordt een vers review-token aangemaakt (oude link uit dezelfde submission vervalt).'
    )
  ),
  'published'
)
on conflict (version) do nothing;
