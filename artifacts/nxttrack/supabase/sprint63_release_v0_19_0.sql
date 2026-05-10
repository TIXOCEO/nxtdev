-- ──────────────────────────────────────────────────────────
-- Sprint 63 — Release notes v0.19.0
-- Programs MVP fase 4: publieke marketplace + deeplink-inschrijven
--
-- Idempotent: insert ... on conflict (version) do nothing.
-- ──────────────────────────────────────────────────────────

insert into public.platform_releases (version, release_type, title, summary, body_json, status, published_at)
values (
  '0.19.0',
  'minor',
  'Programma''s fase 4: publieke marketplace en deeplink-inschrijven',
  'Tenants kunnen hun publieke programma''s nu tonen op een eigen marketplace-pagina /t/<tenant>/programmas met detailpagina''s per programma. Vanaf de detailpagina linkt een CTA rechtstreeks door naar het inschrijfformulier met het programma vóórgeselecteerd, zodat de inschrijving terug-traceerbaar is naar het gekozen programma.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Publieke route /t/<tenant>/programmas toont alle programma''s met visibility=''public'' en een gevulde public_slug.',
      'Detailpagina /t/<tenant>/programmas/<slug> met marketing-titel, marketing-beschrijving, hero-afbeelding, leeftijdsrange en highlights.',
      'Deeplink /t/<tenant>/inschrijven?program=<slug>: het inschrijfformulier toont een banner met het gekozen programma en koppelt de inschrijving automatisch.',
      'Nieuwe member krijgt members.intended_program_id; kinderen van een ouder erven hetzelfde programma als intentie.'
    ),
    'improved', jsonb_build_array(
      'Houtrust-veilig: tenants zonder publieke programma''s zien een nette lege-state met heading + intro + contact-CTA, géén 404.',
      'Sidebar-link "Programma''s" verschijnt alleen voor tenants met minimaal één publiek programma.'
    ),
    'fixed', jsonb_build_array(
      'Defense-in-depth in RPC create_public_registration: cross-tenant program-deeplinks worden geweigerd door een check op tenant_id + visibility=''public''.'
    ),
    'admin', jsonb_build_array(
      'Migratievolgorde productie: sprint63_programs_public → sprint63_release_v0_19_0.',
      'Nieuwe RLS-policy programs_public_read: anon/authenticated kunnen uitsluitend programma''s zien met visibility=''public'' én public_slug IS NOT NULL.',
      'Nieuwe kolommen registrations.program_id en members.intended_program_id zijn beide nullable + composite-FK (program_id, tenant_id) → programs(id, tenant_id) ON DELETE SET NULL.',
      'RPC create_public_registration heeft een nieuwe parameter p_program_id (default null); oude positionele callers werken niet meer en moeten p_program_id mee-passen of weglaten via named-call.',
      'Geen nieuwe notification-source-keys; bestaande dedup-index notifications_source_idem_uq blijft ongewijzigd.'
    )
  ),
  'published',
  now()
)
on conflict (version) do nothing;
