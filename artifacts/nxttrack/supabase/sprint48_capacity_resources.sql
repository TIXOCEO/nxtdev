-- ──────────────────────────────────────────────────────────
-- Sprint 48 — Capaciteit & locaties
--
-- Introduceert tenant-scoped resource-tree (locatie → sub-resource)
-- en koppel-tabel aan training_sessions. Géén btree_gist exclusion-
-- constraint in deze sprint (volgt in een follow-up zodra de UI om
-- conflicten te visualiseren live is) — voorlopig alleen indexen +
-- application-side conflict-warning.
--
-- RLS: tenant-admin via has_tenant_access; lezen door leden via dezelfde
-- join-pattern als training_sessions_member_read.
--
-- Volledig idempotent.
-- ──────────────────────────────────────────────────────────

create table if not exists public.capacity_resources (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  parent_id    uuid        references public.capacity_resources(id) on delete cascade,
  kind         text        not null,
  name         text        not null,
  description  text,
  capacity     int         check (capacity is null or capacity > 0),
  is_active    boolean     not null default true,
  sort_order   int         not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint capacity_resources_kind_chk
    check (kind in ('location','area','lane','field','court','room','other'))
);

create index if not exists capacity_resources_tenant_idx
  on public.capacity_resources (tenant_id, parent_id, sort_order);
create index if not exists capacity_resources_parent_idx
  on public.capacity_resources (parent_id);

drop trigger if exists capacity_resources_updated_at on public.capacity_resources;
create trigger capacity_resources_updated_at
  before update on public.capacity_resources
  for each row execute function public.handle_updated_at();

alter table public.capacity_resources enable row level security;

drop policy if exists "capacity_resources_tenant_all"  on public.capacity_resources;
drop policy if exists "capacity_resources_member_read" on public.capacity_resources;

create policy "capacity_resources_tenant_all" on public.capacity_resources
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Lees-toegang voor leden (zodat sessie-detail de naam kan tonen).
create policy "capacity_resources_member_read" on public.capacity_resources
  for select
  using (
    exists (
      select 1
        from public.members m
       where m.tenant_id = capacity_resources.tenant_id
         and m.user_id   = auth.uid()
    )
  );

-- ── Koppel-tabel session ↔ resource ──────────────────────────────
create table if not exists public.session_resources (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         uuid        not null references public.tenants(id) on delete cascade,
  session_id        uuid        not null references public.training_sessions(id) on delete cascade,
  resource_id       uuid        not null references public.capacity_resources(id) on delete restrict,
  max_participants  int         check (max_participants is null or max_participants > 0),
  notes             text,
  created_at        timestamptz not null default now(),
  unique (session_id, resource_id)
);

create index if not exists session_resources_session_idx  on public.session_resources (session_id);
create index if not exists session_resources_resource_idx on public.session_resources (resource_id);

alter table public.session_resources enable row level security;

drop policy if exists "session_resources_tenant_all"  on public.session_resources;
drop policy if exists "session_resources_member_read" on public.session_resources;

create policy "session_resources_tenant_all" on public.session_resources
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

create policy "session_resources_member_read" on public.session_resources
  for select
  using (
    exists (
      select 1
        from public.training_sessions ts
        join public.group_members     gm on gm.group_id = ts.group_id
        join public.members           m  on m.id = gm.member_id
       where ts.id = session_resources.session_id
         and m.user_id = auth.uid()
    )
  );
