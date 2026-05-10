-- ─────────────────────────────────────────────────────────────────────
-- Sprint 64 — Release notes 0.20.0 (Programs MVP fase 5).
-- Idempotent: insert ... on conflict (version) do update.
-- ─────────────────────────────────────────────────────────────────────

insert into public.platform_releases (
  version,
  release_type,
  title,
  summary,
  body_json,
  status,
  published_at
) values (
  '0.20.0',
  'minor',
  'Programma''s — wachtlijst-koppeling en routing per programma',
  'Wachtlijst-aanvragen kunnen nu aan een specifiek programma worden gekoppeld, en je kunt per programma instellen of nieuwe aanmeldingen op de inschrijving of direct op de wachtlijst landen.',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'heading', 'Nieuw',
        'items', jsonb_build_array(
          'Wachtlijst-aanvragen kunnen aan een programma worden gekoppeld (kolom op zowel `waitlists` als `waitlist_entries`).',
          'Per-programma intake-routing: stel in dat aanmeldingen voor één specifiek programma altijd op de wachtlijst (of altijd als inschrijving) binnenkomen.'
        )
      ),
      jsonb_build_object(
        'heading', 'Verbeterd',
        'items', jsonb_build_array(
          'De aanmeld-routing-cascade is uitgebreid: programma-override (per `?program=`-deeplink) wint van doelgroep-override en die wint van de tenant-default.'
        )
      ),
      jsonb_build_object(
        'heading', 'Opgelost',
        'items', jsonb_build_array(
          'Geen openstaande regressies in deze sprint.'
        )
      ),
      jsonb_build_object(
        'heading', 'Voor admins',
        'items', jsonb_build_array(
          'Op `/tenant/registrations/instellingen` is een nieuw paneel "Per programma overrides" verschenen waarin je publieke programma''s individueel op wachtlijst of inschrijving kunt zetten.'
        )
      )
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
