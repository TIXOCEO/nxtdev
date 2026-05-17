-- ============================================================================
-- Sprint 79 release notes — v0.37.0
-- ============================================================================
-- Idempotent insert in public.platform_releases (do-nothing on conflict).
-- Sprint 79 — UserShell-redesign rest: publieke shell (aankomende sessies +
-- uitgelichte events + module-grid polish), trainer-shell fundament, parent-
-- shell fundament.
-- ============================================================================

set search_path = public;

insert into public.platform_releases (
  version, release_type, published_at, title, summary, body_json, status
) values (
  '0.37.0',
  'minor',
  now(),
  'Aankomende sessies, uitgelichte events en trainer/ouder-fundament',
  'Sprint 79 voltooit het UserShell-redesign: de publieke homepage krijgt een tegel met aankomende sessies (optioneel zichtbaar) en uitgelichte events; trainer- en ouder-/lid-omgevingen krijgen het database-fundament voor taken, documenten en parent-portal notificaties.',
  jsonb_build_object(
    'new', jsonb_build_array(
      'Publieke homepage: nieuwe tegel "Aankomende sessies" toont de eerstvolgende 14 dagen aan trainingen — alleen titel, tijd en groep, geen deelnemerslijst. Per tenant aan/uit via een toggle in de instellingen.',
      'Publieke homepage: nieuwe tegel "Uitgelichte events" toont het eerstvolgende event uit de nieuwe events-beheermodule. Tenant-admins beheren events onder Tenant → Events.',
      'Trainer-omgeving fundament: tabellen voor trainer-taken (open/done/cancelled met prioriteit + due-date) en gedeelde trainer-documenten (handleiding/protocol/formulier/overig). UI-koppeling volgt in een vervolgsprint.',
      'Notificatie-key trainer_task_assigned voorbereid: zodra de UI live gaat, krijgen trainers een melding wanneer een taak aan hen wordt toegewezen.'
    ),
    'improved', jsonb_build_array(
      'Module-grid op de publieke homepage gebruikt nu een vaste rij-hoogte op desktop met interne scroll per tegel — voorkomt dat één lange tegel de hele grid uit balans trekt.',
      'Read-only view `public_upcoming_sessions` is gedefinieerd met `security_invoker=true` en expliciete grants aan anon+authenticated; toont géén PII (geen aanwezigheid, geen notities).'
    ),
    'fixed', jsonb_build_array(),
    'admin', jsonb_build_array(
      'Drie nieuwe tabellen (`tenant_events`, `trainer_tasks`, `trainer_documents`) — allemaal nullable defaults + composite-FK pattern + RLS-policies (publiek read voor events, tenant-scoped voor taken/documenten).',
      'Setting `settings_json.public_show_upcoming_sessions` bestuurt de aankomende-sessies-tegel op de publieke homepage; default `false` zodat bestaande tenants ongewijzigd blijven.',
      'Notification dedup-index uitgebreid met `trainer_task_assigned` (drop+recreate pattern Sprint 41/43/53/55/57/64/65/66/73/74/76/77); `create_notification_with_recipients` herbouwd met dezelfde key in de dedup-array.'
    )
  ),
  'published'
)
on conflict (version) do nothing;
