-- ============================================================================
-- Sprint 77 release notes — v0.34.0
-- ============================================================================
-- Idempotent insert in public.platform_releases (do-nothing on conflict).
-- Pattern: Sprint 73/74/75/76 release-SQL.
-- ============================================================================

set search_path = public;

insert into public.platform_releases (
  version, release_type, published_at, title, summary, body_json, status
) values (
  '0.34.0',
  'minor',
  now(),
  'Backend-fundament voor ouderportaal en visuele agenda',
  'Sprint 77 legt het backend-fundament voor het ouderportaal (fase 6) en de visuele drag-and-drop agenda (fase 7). Geen UI-wijzigingen — de bouwstenen staan klaar voor de redesign-sprints die hierna volgen.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Ouderportaal-notificaties: zes nieuwe notificatie-types gereserveerd (aanwezigheid, gemist, sessie geannuleerd, lidmaatschap verloopt, plaatsing aangeboden, notitie gepubliceerd). Routering naar ouders verloopt automatisch via de bestaande minor → parent reroute.',
      'Trainer-notities per leerling per sessie met zichtbaarheid intern of extern. Externe notities zijn straks zichtbaar voor de ouder via het ouderportaal; interne notities blijven binnen het instructeur-team.',
      'Agenda-data RPC: één call haalt sessies, resources, instructeurs en groepen op voor een week- of dagvenster (max 35 dagen) — basis voor de nieuwe visuele agenda.',
      'Drag-and-drop fundament: preview- en move-RPC met conflict-detectie op resources en instructeurs, plus optimistic locking zodat gelijktijdige bewerkingen elkaar niet overschrijven.'
    ),
    'improved', jsonb_build_array(
      'Audit-spoor uitgebreid met training.session.moved en training.session.move_conflict zodat elke agenda-mutatie traceerbaar is, inclusief wie een conflict overruled heeft.'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'training_sessions heeft nu een lock_version-kolom (default 0). Oudere code-paden blijven werken; alleen de nieuwe move_session-RPC checkt en bumpt deze waarde.',
      'Tenant-instelling settings_json.parent_notifications komt straks beschikbaar om per ouderportaal-notificatietype aan/uit te zetten (default: aan voor alle types).'
    )
  ),
  'published'
)
on conflict (version) do nothing;
