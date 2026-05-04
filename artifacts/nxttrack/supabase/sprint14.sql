-- Sprint 14 — Per-user notification channel preferences.
--
-- Lets each user opt OUT of email and/or push for a specific event_key
-- inside a tenant. Absence of a row = enabled (default-on).

create table if not exists public.user_notification_preferences (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  event_key   text        not null,
  channel     text        not null check (channel in ('email','push')),
  enabled     boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, tenant_id, event_key, channel)
);

create index if not exists user_notification_preferences_user_idx
  on public.user_notification_preferences (user_id, tenant_id);

drop trigger if exists user_notification_preferences_updated_at
  on public.user_notification_preferences;
create trigger user_notification_preferences_updated_at
  before update on public.user_notification_preferences
  for each row execute function public.handle_updated_at();

alter table public.user_notification_preferences enable row level security;

drop policy if exists "unp_self_all"   on public.user_notification_preferences;
drop policy if exists "unp_tenant_read" on public.user_notification_preferences;

-- Owner manages own rows.
create policy "unp_self_all" on public.user_notification_preferences
  for all using (auth.uid() = user_id)
          with check (auth.uid() = user_id);

-- Tenant admins (and platform admins) may read for support/diagnostics.
create policy "unp_tenant_read" on public.user_notification_preferences
  for select using (public.has_tenant_access(tenant_id));
