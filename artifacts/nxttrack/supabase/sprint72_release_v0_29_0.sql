-- ═════════════════════════════════════════════════════════════════
-- Sprint 72 — Release notes v0.29.0 (Program stages fundament)
-- ═════════════════════════════════════════════════════════════════

insert into public.platform_releases (
  version, release_type, title, summary, body_json, status, published_at
) values (
  '0.29.0',
  'minor',
  'Niveaus per programma — stages vervangen vrije-tekst level_band',
  'Niveau-data zit nu in een eigen tabel per programma (stages) in plaats van als vrije-tekst op de groep. Tenant-admins beheren stages onder een programma; groepen kunnen aan meerdere stages worden gekoppeld; plaatsings-suggesties matchen op stage in plaats van op tekst.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Nieuw tabblad ''Stages'' op de programma-detailpagina met aan-/uitzetten per programma, CRUD voor stages (naam, kleur, beschrijving, volgorde) en archiveren.',
      'Groepsdetailpagina toont nu een multi-select voor stages binnen het programma in plaats van een vrije-tekst niveau-label.',
      'Intake-submissions slaan recommended_stage_id (automatisch afgeleid) en selected_stage_id (door admin gekozen) op zodat plaatsings-scoring exact weet wat de bedoelde stage is.',
      'Zwemschool-tenants krijgen bij aanmaak 5 default stages onder hun zwemschool-programma (Watergewenning, Drijven, Schoolslag basis, Rugslag basis, Afzwem-ready).'
    ),
    'improved', jsonb_build_array(
      'Plaatsings-RPC scoort niveau nu op stage-match (groep heeft target-stage gekoppeld via group_stages) in plaats van op vrije-tekst level_band.',
      'Plaatsings-suggesties tonen in de niveau-uitleg de gekoppelde stages van elke groep én welke stage als doel werd gebruikt.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'Bestaande groups.level_band-waarden zijn één-op-één gemigreerd naar program_stages + group_stages; daarna is de kolom gedropt.',
      'Backfill is idempotent (on conflict do nothing) — opnieuw uitvoeren maakt geen duplicate stages.',
      'programs.use_stages staat default op false; alleen programma''s met bestaande level_band-waarden (of de zwemschool-seed) zijn automatisch geactiveerd.'
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
