-- ============================================================================
-- Sprint 78b release notes — v0.36.0
-- ============================================================================
-- Idempotent insert in public.platform_releases (do-nothing on conflict).
-- Sprint 78b Fase 2 — DB-lichte content voor de publieke tenant-shell:
-- Welkom-, Locatie- en Trainers-kaarten op de fallback-homepage.
-- ============================================================================

set search_path = public;

insert into public.platform_releases (
  version, release_type, published_at, title, summary, body_json, status
) values (
  '0.36.0',
  'minor',
  now(),
  'Welkom, Locatie en Trainers op de publieke homepage',
  'Sprint 78b voegt drie nieuwe content-kaarten toe aan de publieke tenant-homepage: een vrije welkomsttekst met "Lees meer"-link, een locatie-kaart met adres en Google Maps-deeplink, en een trainers-kaart met drie willekeurige trainers + een volledige trainers-overzichtspagina.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Welkom-kaart: vrije welkomsttekst (max 2000 tekens) + optionele "Lees meer"-link op de publieke homepage. Te beheren onder Tenant → Profiel.',
      'Locatie-kaart: adresgegevens (naam, straat, postcode, plaats, land) plus optionele coördinaten. Bevat een directe Google Maps-knop op basis van coördinaten of het adres.',
      'Trainers-kaart op de homepage met drie willekeurig gekozen trainers (avatar, naam, functietitel) en een doorklik naar de volledige `/t/[slug]/trainers`-pagina.',
      'Per trainer kun je nu een functietitel (bv. "Hoofdinstructeur"), een foto-URL en een sortering instellen op de "Publiek trainer profiel"-tab.'
    ),
    'improved', jsonb_build_array(
      'Tenant-profielformulier heeft nieuwe secties "Welkom-kaart" en "Locatie-kaart" met inline validatie (URL-format, lat/lon-bereik, max tekenlengte).',
      'Lege kaarten (zonder ingevulde content) renderen niets en houden de homepage-grid netjes.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'Drie nieuwe nullable kolommen op `members` (`public_role_label`, `public_photo_url`, `public_position`) plus negen op `tenants` (`welcome_text`, `welcome_more_url`, `location_*`, `latitude`, `longitude`). Geen RLS-wijzigingen — bestaande policies blijven werken.',
      'View `public_trainers` herbouwd zodat de extra trainer-velden ook publiek beschikbaar zijn (security_invoker behouden).'
    )
  ),
  'published'
)
on conflict (version) do nothing;
