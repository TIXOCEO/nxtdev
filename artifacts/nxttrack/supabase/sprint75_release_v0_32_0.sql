-- ═════════════════════════════════════════════════════════════════
-- Sprint 75 — Release notes v0.32.0 (Publieke wachtrij-indicator).
-- Idempotent.
-- ═════════════════════════════════════════════════════════════════

insert into public.platform_releases
  (version, release_type, title, summary, body_json, status, published_at)
values (
  '0.32.0',
  'minor',
  'Wachtrij-indicator op publieke programma''s',
  'Bezoekers van de publieke marketplace zien voortaan per programma in één oogopslag of de wachtrij kort, gemiddeld of lang is. Geen exacte aantallen — alleen een kleur + label. Tenant-admins kunnen drempels en een optioneel "verwachte wachttijd"-label per programma instellen.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Marketplace-kaarten op /t/<slug>/programmas tonen een groen/oranje/rood badge: "Korte / Gemiddelde / Lange wachtrij".',
      'Programma-detailpagina krijgt een prominent beschikbaarheidsblok; als een programma stages gebruikt is er ook een mini-tabel per stage.',
      'Optioneel "verwachte wachttijd"-label (vrije tekst, bv. "± 6 weken") per programma instelbaar door tenant-admin.'
    ),
    'improved', jsonb_build_array(
      'Twee read-only views (program_waitlist_indicator + _by_stage) aggregeren wachtenden vs openstaande capaciteit over de eerstvolgende 12 weken.',
      'Bucketing is een pure helper in de app-laag, dus eenvoudig te testen en consistent tussen lijst en detail.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'Stel drempels in per programma onder Programma-overzicht → "Wachtrij-indicator" (low / high). Default low=5, high=15.',
      'Heuristiek: available_seats ≤ 0 OF waiting_count ≥ high → lang; waiting_count ≥ low → gemiddeld; anders kort.',
      'Bron-data: intake_submissions.status=''waitlisted'' + waitlist_entries.status=''waiting'' vs capaciteit uit program_capacity_overview (komende 84 dagen).'
    )
  ),
  'published',
  now()
)
on conflict (version) do update set
  release_type = excluded.release_type,
  title        = excluded.title,
  summary      = excluded.summary,
  body_json    = excluded.body_json,
  status       = excluded.status,
  published_at = excluded.published_at;
