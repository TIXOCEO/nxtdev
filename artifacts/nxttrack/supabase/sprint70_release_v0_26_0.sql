-- ═════════════════════════════════════════════════════════════════
-- Sprint 70 — Release notes v0.26.0 (Placement-assistent)
-- ═════════════════════════════════════════════════════════════════

insert into public.platform_releases (
  version, release_type, title, summary, body_json, status, published_at
) values (
  '0.26.0',
  'minor',
  'Plaatsingssuggesties voor intake-aanvragen',
  'Tenant-admins krijgen een advisory paneel met top-5 groepssuggesties per intake-submission, met componentscores op capaciteit, tijdvoorkeur, locatie, leeftijd en niveau.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Submission-detailpagina onder /tenant/intake/[id] met antwoorden, status en contactgegevens.',
      'Plaatsingssuggesties-paneel met top-5 kandidaat-groepen en uitlegbare scores.',
      'Eén-klik "Plaats hier"-knop legt suggestie-rank en -score vast in het audit-log.'
    ),
    'improved', jsonb_build_array(
      'Intake-overzicht linkt nu door naar de submission-detailpagina.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'Nieuwe RPC score_placement_candidates(submission_id) — advisory only, raakt geen data aan.',
      'Audit-key intake.submission.placed met meta {group_id, suggestion_rank, suggestion_score}.'
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
