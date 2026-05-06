-- Sprint 33 — Per-user release-read tracking.
--
-- Houdt bij welke release-versies een gebruiker (i.h.b. tenant-admins) heeft
-- gezien, zodat de dashboard-container en het versielabel een subtiele
-- "nieuw"-indicator kunnen tonen tot de release als gezien is gemarkeerd.
-- Idempotent uitvoerbaar.

create table if not exists public.release_reads (
  user_id  uuid not null references auth.users(id) on delete cascade,
  version  text not null references public.platform_releases(version) on delete cascade,
  seen_at  timestamptz not null default now(),
  primary key (user_id, version)
);

create index if not exists idx_release_reads_user
  on public.release_reads (user_id);

alter table public.release_reads enable row level security;

-- Een gebruiker mag uitsluitend zijn eigen leesstatus zien én bijwerken.
drop policy if exists "release_reads_self_select" on public.release_reads;
create policy "release_reads_self_select" on public.release_reads
  for select
  using (auth.uid() = user_id);

drop policy if exists "release_reads_self_insert" on public.release_reads;
create policy "release_reads_self_insert" on public.release_reads
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "release_reads_self_update" on public.release_reads;
create policy "release_reads_self_update" on public.release_reads
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
