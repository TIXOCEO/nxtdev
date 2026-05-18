-- ============================================================================
-- Sprint 82 release notes — v0.40.0
-- ============================================================================
-- Idempotent insert in public.platform_releases.
-- Sprint 82 — Slimme intake: 3 tijdsblok-voorstellen na submit,
-- transparante wachtlijst-keuze, conditional formuliervelden.
-- ============================================================================

set search_path = public;

insert into public.platform_releases (
  version, release_type, published_at, title, summary, body_json, status
) values (
  '0.40.0',
  'minor',
  now(),
  'Slimme intake — kies zelf je tijdsblok',
  'Sprint 82 maakt het publieke inschrijfformulier slimmer: aanvragers zien direct 3 best passende tijdsblokken na hun aanmelding, met verwachte wachttijd per groep. Bij geen vrije plek kiest de aanvrager expliciet of er een wachtlijst-aanvraag aangemaakt moet worden.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Conditional fields in het intake-formulier — vragen verschijnen alleen als ze relevant zijn (bv. "Huidig niveau" alleen wanneer kind al lessen heeft gehad).',
      'Publieke pagina "Kies je tijdsblok" met top-3 voorstellen, gesorteerd op kortste wachttijd en match-score.',
      'Wachttijd-badge per groep (groen ≤2 wk, geel 3–8 wk, rood >8 wk).',
      'Transparante wachtlijst-keuze: bij 0 vrije plekken kiest de aanvrager zelf "ja, op wachtlijst" of "nee, annuleren".'
    ),
    'improved', jsonb_build_array(
      'Stille auto-waitlist vervangen door expliciete keuze — geen verrassingen meer voor aanvragers.',
      'Slot-aanbod uit de voorstellen-pagina gebruikt een tijdelijk review-token (7 dagen).'
    ),
    'fixed', jsonb_build_array(
      'show_if-evaluatie ondersteunt nu ook not_equals en in-operators (was alleen equals).'
    ),
    'admin', jsonb_build_array(
      'Nieuwe tenant-instelling "Publieke tijdsblok-voorstellen" onder /tenant/settings/intake — default uit. Wanneer aan, zien aanvragers direct de 3 voorstellen i.p.v. alleen een bevestigingsmail.',
      'Intake-detailpagina krijgt een knop "Stuur 3 voorstellen aan aanvrager" — verstuurt een mail met review-link.'
    )
  ),
  'published'
)
on conflict (version) do nothing;
