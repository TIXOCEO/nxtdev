-- ═════════════════════════════════════════════════════════════════
-- Sprint 73 — Release notes v0.30.0 (Submission lifecycle + stage-tip)
-- ═════════════════════════════════════════════════════════════════

insert into public.platform_releases (
  version, release_type, title, summary, body_json, status, published_at
) values (
  '0.30.0',
  'minor',
  'Triage-flow voor intake — beoordelen, wachtlijst, plaatsen of afwijzen',
  'Intake-aanvragen lopen voortaan door een echte triage-flow met statussen (in beoordeling, vereist beoordeling, wachtlijst, geplaatst, afgewezen). Het systeem herkent zelf aanvragen die om aandacht vragen (medische opmerking, leeftijd buiten range, ontbrekende gegevens) en stelt op basis van de antwoorden alvast een stage voor.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Submission-detailpagina toont een status-strip met knoppen voor Beoordelen, Naar wachtlijst, Plaatsen en Afwijzen.',
      'Een nieuwe statuskolom "Vereist beoordeling" verschijnt bovenaan het intake-overzicht zodra er aanvragen op die status staan.',
      'Bij elke nieuwe aanmelding bepaalt het systeem automatisch een aanbevolen stage op basis van leeftijd en antwoorden; admins kunnen die met één klik overschrijven.',
      'Tenant-admins krijgen een notificatie zodra een aanmelding op "vereist beoordeling" belandt.'
    ),
    'improved', jsonb_build_array(
      'Statusfilter op het intake-overzicht is uitgebreid met alle nieuwe lifecycle-statussen.',
      'Audit-log registreert elke statuswissel met from/to + reden zodat triage-tijden later meetbaar zijn.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'Oude statussen (reviewing/eligible/cancelled) worden eenmalig gemapt naar de nieuwe set (in_review / submitted / rejected). Bestaande data blijft behouden.',
      'Notification-dedup is uitgebreid met sleutel intake_submission_needs_review (source_ref = submission.id) zodat herhaalde triggers niet stapelen.'
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
