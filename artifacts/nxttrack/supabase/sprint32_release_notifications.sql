-- Sprint 32 — Release-publish notifications.
--
-- Stuurt tenant-admins een melding (in-app, optioneel e-mail) bij elke
-- nieuwe release-publicatie. Idempotent op (release_id, tenant_id) zodat
-- opnieuw publiceren van dezelfde versie geen tweede notificatie triggert.
-- Idempotent uitvoerbaar.

create table if not exists public.platform_release_notifications (
  release_id      uuid not null references public.platform_releases(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  notified_at     timestamptz not null default now(),
  primary key (release_id, tenant_id)
);

create index if not exists idx_platform_release_notifs_tenant
  on public.platform_release_notifications (tenant_id);

alter table public.platform_release_notifications enable row level security;

drop policy if exists "prn_admin_select" on public.platform_release_notifications;
create policy "prn_admin_select" on public.platform_release_notifications
  for select
  using (public.is_platform_admin());
