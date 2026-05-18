-- ============================================================================
-- Sprint 80 release notes — v0.38.0
-- ============================================================================
-- Idempotent insert in public.platform_releases.
-- Sprint 80 — UserShell-redesign voltooid: trainer-shell UI (Taken,
-- Documenten, Beoordelen-skill-grid), parent/lid-shell UI (Voortgang,
-- Lessen, Diploma's, Betalingen).
-- ============================================================================

set search_path = public;

insert into public.platform_releases (
  version, release_type, published_at, title, summary, body_json, status
) values (
  '0.38.0',
  'minor',
  now(),
  'Trainer- en ouder-omgevingen compleet',
  'Sprint 80 voltooit het UserShell-redesign: trainers krijgen eigen pagina''s voor Taken en Documenten en kunnen leerlingen beoordelen via een 5-niveau skill-grid. Ouders en leden krijgen vier nieuwe pagina''s: Voortgang, Mijn lessen, Diploma''s en Betalingen.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Trainers: nieuwe pagina Taken met overzicht per deadline.',
      'Trainers: nieuwe pagina Documenten met handleidingen en protocollen per categorie.',
      'Trainers: skill-grid beoordeling per leerling in sessie-detail (5 niveaus).',
      'Ouders/leden: nieuwe pagina Voortgang met behaalde skills per kind.',
      'Ouders/leden: nieuwe pagina Mijn lessen met aankomende en recente sessies.',
      'Ouders/leden: nieuwe pagina Diploma''s met behaalde certificaten per kind.',
      'Ouders/leden: nieuwe pagina Betalingen met openstaande en betaalde facturen.'
    ),
    'improved', jsonb_build_array(
      'Module-grid op de publieke homepage gebruikt vaste rij-hoogtes met interne scroll per tegel.',
      'Sidebar navigatie uitgebreid met trainer- en ouder-secties zonder de bestaande items te raken.'
    ),
    'fixed', jsonb_build_array(
      'tenant_modules_size_check defensief herzet zodat alle vier formaten (1x1, 1x2, 2x1, 2x2) altijd toegestaan zijn.'
    ),
    'admin', jsonb_build_array(
      'Beheerders kunnen taken toewijzen aan trainers onder /tenant/taken.',
      'Beheerders kunnen documenten beheren onder /tenant/documenten (categorieën: handleiding, protocol, formulier, overig).',
      'Beheerders kunnen diploma''s toekennen onder /tenant/diplomas; ouders krijgen automatisch een melding via de bestaande notif-dedup.'
    )
  ),
  'published'
)
on conflict (version) do nothing;
