-- ============================================================================
-- Sprint 82e release notes — v0.40.2
-- ============================================================================
-- Patch-release: kleine verbeteringen rond de slimme-intake voorstellen-flow.
-- - Admins zien op de intake-aanvraag wanneer de voorstellen-mail laatst is
--   verstuurd en tot wanneer de link nog geldig is (task #147).
-- - Aanvragers met een verlopen of al-gebruikte voorstellen-link krijgen nu
--   een duidelijke uitleg met contact-knop in plaats van een lege foutmelding
--   (task #148).
-- Geen schema-wijzigingen.
-- ============================================================================

set search_path = public;

insert into public.platform_releases (
  version, release_type, published_at, title, summary, body_json, status
) values (
  '0.40.2',
  'patch',
  now(),
  'Slimme intake: duidelijkere status en vriendelijke fallback',
  'Admins zien direct of een voorstellen-mail al verstuurd is en tot wanneer de link geldig is. Aanvragers wier link is verlopen krijgen nu een duidelijke uitleg met een contact-knop.',
  jsonb_build_object(
    'new', jsonb_build_array(),
    'improved', jsonb_build_array(
      'Op de intake-detailpagina staat onder de "Stuur voorstellen-link"-knop wanneer de mail laatst is verstuurd en tot wanneer de huidige link geldig is.',
      'De knop verandert in "Stuur nieuwe voorstellen-link" zodra er nog een actieve link bestaat, met een bevestigingsvraag voor je een tweede mail verstuurt.',
      'Verlopen of al-gebruikte voorstellen-links tonen aanvragers nu een vriendelijke uitleg (7 dagen geldig, eenmalig bruikbaar) met een directe contact-knop naar de academie en een link terug naar de homepage.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'In de submission-history-tijdlijn verschijnt elke verzending van een voorstellen-link nu als leesbare regel "Voorstellen-link verstuurd" in plaats van de ruwe audit-key.'
    )
  ),
  'published'
)
on conflict (version) do nothing;
