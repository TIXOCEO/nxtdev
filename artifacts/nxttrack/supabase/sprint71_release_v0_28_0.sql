-- ═════════════════════════════════════════════════════════════════
-- Sprint 71 — Release notes v0.28.0 (Plaatsings-statistieken)
-- ═════════════════════════════════════════════════════════════════
-- Geen schema-migratie; deze release dekt de stats-card en de
-- audit-meta-uitbreiding (submission_id + top5_max_score) die in
-- task #109 zijn doorgevoerd na v0.27.0.
-- ═════════════════════════════════════════════════════════════════

insert into public.platform_releases (
  version, release_type, title, summary, body_json, status, published_at
) values (
  '0.28.0',
  'minor',
  'Plaatsings-opvolgstatistieken op de intake-pagina',
  'Tenant-admins zien bovenaan /tenant/intake een statistiekenkaart met 6 KPI''s over plaatsings-gedrag: hoe vaak het paneel wordt gebruikt, gemiddelde suggestie-rang en -score, gemiddelde tijd-tot-plaatsing en het percentage zwakke top-5-matches.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Statistiekenkaart op /tenant/intake met 6 plaatsings-KPI''s (alleen tenant-admins, alleen wanneer dynamic intake aan staat).',
      'KPI ''gem. tijd-tot-plaatsing'' (uren of dagen) op basis van audit-event-tijd vs submission-tijd.',
      'KPI ''top-5 zwak (≤20)'' meet hoe vaak er geen sterke kandidaat-groep was op het moment van plaatsing.'
    ),
    'improved', jsonb_build_array(
      'Plaatsings-audit-meta bevat nu submission_id en top5_max_score zodat statistieken consistent geaggregeerd kunnen worden.',
      'Plaatsings-RPC-fouten worden niet langer als ''geen kandidaten'' verborgen — paneel valt netjes terug op lege-state.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'Aggregator pagineert audit_logs (1000/pagina) en batched submission-lookups (200/batch) — geen hard cap van 2000 rijen meer.',
      'Oude audit-rijen zonder de nieuwe meta worden netjes uit teller én noemer gehouden; n-sample-size staat in de tile-hint.'
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
