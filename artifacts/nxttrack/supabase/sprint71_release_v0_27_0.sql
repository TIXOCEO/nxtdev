-- ═════════════════════════════════════════════════════════════════
-- Sprint 71 — Release notes v0.27.0 (Niveau-data in plaatsing)
-- ═════════════════════════════════════════════════════════════════

insert into public.platform_releases (
  version, release_type, title, summary, body_json, status, published_at
) values (
  '0.27.0',
  'minor',
  'Niveau-data in plaatsingssuggesties',
  'Plaatsingssuggesties wegen nu echt mee of het niveau van een groep aansluit op de voorkeur van de aanvrager. Tenant-admins kunnen per groep een niveau-label instellen.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Niveau-label (level_band) per groep, in te stellen vanuit de groepsdetailpagina.',
      'Plaatsingssuggesties tonen nu een echte niveau-score (10% gewicht) i.p.v. een placeholder.',
      'Rationale legt uit waarom een groep wel/niet op niveau matcht.'
    ),
    'improved', jsonb_build_array(
      'Form-builder accepteert nu canonical_target=preferred_level zodat een formulierveld als niveau-voorkeur kan worden gemarkeerd.',
      'Zwemschool sector-default mapt het veld "Huidig niveau" automatisch naar preferred_level.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'Migratie sprint71_groups_level_band.sql voegt groups.level_band toe en herbouwt validate_intake_form + score_placement_candidates.',
      'Geen backfill: groepen zonder niveau-label krijgen score 0 met heldere rationale; flag-off tenants ondervinden geen impact.'
    )
  ),
  'published',
  now()
)
on conflict (version) do update set
  status       = excluded.status,
  published_at = excluded.published_at,
  body_json    = excluded.body_json,
  summary      = excluded.summary,
  title        = excluded.title;
