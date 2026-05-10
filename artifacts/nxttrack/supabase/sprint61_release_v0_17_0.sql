-- ──────────────────────────────────────────────────────────
-- Sprint 61 — Release notes v0.17.0
-- Programs MVP fase 2: instructeurs + resources defaults
--
-- Idempotent: insert ... on conflict (version) do nothing.
-- ──────────────────────────────────────────────────────────

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values (
  '0.17.0',
  'minor',
  'Programma''s fase 2: instructeurs- en resource-defaults',
  'Programma''s krijgen er twee planning-tabbladen bij. Wijs default-instructeurs en default-resources toe op programma-niveau; sessies erven die automatisch zodra ze aan het programma hangen. De conflict-detectie en de "wie staat er op deze sessie"-view kennen nu een derde fallback-laag.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Programma-detail krijgt twee nieuwe tabbladen: Instructeurs (default-toewijzingen, primary/assistant) en Resources (default-resource-bindingen die op sessie-creatie automatisch naar de sessie worden gekopieerd).',
      'Sessie-aanmaak kan optioneel een programma kiezen — de gekoppelde resources worden direct aangemaakt op de sessie en de instructeursplanning leest de program-defaults als laatste fallback.',
      'Cascade-helpers in de app-laag: getEffectiveCapacity en getEffectiveMinInstructors lezen sessie → groep → programma in één call.'
    ),
    'improved', jsonb_build_array(
      'View session_instructors_effective heeft nu drie lagen: expliciete sessie-instructeur → group-trainer → program-instructeur. Identiek gedrag voor sessies zonder program_id.',
      'RPC detect_instructor_conflicts neemt programs.default_min_instructors mee in de understaffed-coalesce: coalesce(session.min, group.default, program.default, 1).',
      'Composite (id, tenant_id) unique op training_sessions — voorbereiding voor verdere program-koppelingen in Sprint 62+.',
      'Permissions: programma-instructeur- en resource-toewijzingen vallen onder bestaande catalog-keys programs.assign_instructors en programs.manage_resources.'
    ),
    'fixed', jsonb_build_array(
      'Geen Houtrust-regressie: training_sessions.program_id is nullable en blijft NULL voor alle bestaande sessies; view en RPC produceren byte-identieke uitkomsten zolang program_id NULL is.'
    ),
    'admin', jsonb_build_array(
      'Migratievolgorde productie: sprint61_program_planning → sprint61_release_v0_17_0.',
      'Nieuwe tabellen program_instructors en program_resources zijn leeg na migratie; alleen RLS via has_tenant_access(tenant_id), geen aparte member-read-policy nodig (admin-only screens).',
      'Default-resources worden bij sessie-aanmaak gekopieerd door de server-action createTrainingSession, niet door een trigger — zo blijft de bestaande btree_gist exclusion-constraint op session_resources (Sprint 55) automatisch dubbel-boekingen detecteren.',
      'assignment_type op program_instructors accepteert alleen primary of assistant; substitute en observer blijven sessie-niveau-only.',
      'Sprint 61 levert nog GEEN program-membership-plans (Sprint 62), publieke marketplace (Sprint 63) of waitlist-koppeling (Sprint 64).'
    )
  ),
  'published',
  now()
)
on conflict (version) do nothing;
