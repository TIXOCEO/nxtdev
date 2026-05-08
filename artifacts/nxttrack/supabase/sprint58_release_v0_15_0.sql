-- ──────────────────────────────────────────────────────────
-- Sprint 58 — Release notes v0.15.0 (Instructeursplanning MVP)
--
-- Idempotent: insert ... on conflict (version) do nothing.
-- ──────────────────────────────────────────────────────────

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values (
  '0.15.0',
  'minor',
  'Instructeursplanning: beschikbaarheid, expliciete sessietoewijzing en conflictdetectie',
  'Een planningslaag bovenop de bestaande trainer-rol — leg per instructeur vast wanneer ze beschikbaar zijn, wijs ze expliciet toe aan sessies (incl. vervangers), en zie in één oogopslag dubbele boekingen, afwezigheidsbotsingen en onderbezette sessies.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Instructeurs-overzicht onder Planning — lijst van alle leden met de trainer-rol plus aankomende sessietelling.',
      'Beschikbaarheid per instructeur: wekelijks ritme (dag + tijdblok) en datum-specifieke afwezigheid (vakantie, ziekte, cursus).',
      'Sessie-instructeurs: wijs leden expliciet toe als hoofdinstructeur, assistent, vervanger of observer. Vervanger kan optioneel verwijzen naar wie hij/zij vervangt.',
      'Effectieve toewijzing met fallback: zonder expliciete toewijzing tellen alle group-trainers automatisch mee — Houtrust en bestaande clubs zien dus geen gedragsverandering tot ze zelf toewijzen.',
      'Plannings­conflicten-pagina: dubbele boekingen, sessies die buiten weekly availability vallen, en sessies tijdens een afwezigheidsblok.',
      'Onbemand-pagina: sessies waar minder primary-instructeurs op staan dan vereist (per groep instelbaar of per sessie overschreven).',
      'Publieke /agenda voor instructeurs: alleen de sessies waarop jij zelf staat, met vervanger-/assistent-/observer-label.'
    ),
    'improved', jsonb_build_array(
      'Notificatie-deduplicatie uitgebreid met instructor.assignment.added, instructor.assignment.removed en instructor.substitute.assigned (Sprint 41/43-patroon).',
      'Sector-terminologie aangevuld met instructor_singular/plural — football_school behoudt "Trainer", swimming_school krijgt "Zweminstructeur" als label.'
    ),
    'fixed', jsonb_build_array(
      'Geen Houtrust-regressie: zonder expliciete sessie-instructeurs of min_instructors-waarde gedraagt alles zich identiek aan voor v0.15.0.'
    ),
    'admin', jsonb_build_array(
      'Migratievolgorde productie: sprint57 → sprint58.',
      'Conflict-detectie loopt via RPC `detect_instructor_conflicts(p_tenant_id, p_from, p_to)` en geeft 4 conflict_kind-waarden terug: overlap, unavailable_block, not_available_weekly, understaffed.',
      'Min-instructeurs: stel een groepsdefault in (`groups.default_min_instructors`) of overschrijf per sessie (`training_sessions.min_instructors`); NULL = geen ondergrens.',
      'Beschikbaarheid is een wekelijks patroon (day_of_week 0-6 = ma-zo) met optionele valid_from/valid_until om bv. seizoensbeschikbaarheid te modelleren.',
      'btree_gist exclusion-constraint op instructor_unavailability voorkomt overlappende afwezigheidsblokken voor dezelfde instructeur.',
      'View `session_instructors_effective` (security_invoker=true) is de canonieke read-bron voor "wie staat er op deze sessie" — combineert expliciete toewijzingen met de impliciete trainer-fallback per groep.'
    )
  ),
  'published',
  now()
)
on conflict (version) do nothing;
