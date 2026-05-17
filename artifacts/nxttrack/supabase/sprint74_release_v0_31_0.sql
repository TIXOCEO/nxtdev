-- ═════════════════════════════════════════════════════════════════
-- Sprint 74 — Release notes v0.31.0 (auto-waitlist + slot-offer).
-- Idempotent.
-- ═════════════════════════════════════════════════════════════════

insert into public.platform_releases
  (version, release_type, title, summary, body_json, status, published_at)
values (
  '0.31.0',
  'minor',
  'Auto-wachtlijst en plek aanbieden voor intake',
  'Aanmeldingen zonder vrije plek worden automatisch op de wachtlijst gezet en krijgen een wachtbericht. Vanuit het plaatsings-paneel kun je nu een plek aanbieden via een e-mail met accept/weiger-link.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Auto-wachtlijst: nieuwe intake zonder vrije capaciteit krijgt direct status "wachtlijst" + bevestigingsmail.',
      'Knop "Plek aanbieden" in het plaatsings-paneel: stuurt ouder een mail met token-link (72 uur geldig, instelbaar).',
      'Publieke accept/decline-pagina''s op /intake-slot/<token>/accept en /decline, zonder login.',
      'Sectie "Aangeboden plekken" op de submission-detailpagina met tijdlijn (pending/accepted/declined/expired).'
    ),
    'improved', jsonb_build_array(
      'Plek aanbieden gebruikt dezelfde plaatsings-logica als handmatig plaatsen (uniforme lifecycle + audit).',
      'Drie nieuwe dedup-keys voor in-app meldingen: intake_slot_offered, intake_slot_accepted, intake_slot_declined.'
    ),
    'fixed', jsonb_build_array(
      'Aanvragen zonder passende groep blijven niet langer stilzwijgend op "ingediend" hangen.'
    ),
    'admin', jsonb_build_array(
      'Stel optioneel een eigen geldigheidsduur in via tenants.settings_json.intake_slot_offer_ttl_hours (default 72).',
      'Verlopen aanbiedingen worden niet automatisch teruggedraaid; de admin ziet "expired" in de tijdlijn.'
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
  published_at = coalesce(public.platform_releases.published_at, excluded.published_at),
  updated_at   = now();

-- Einde sprint74_release_v0_31_0.sql.
