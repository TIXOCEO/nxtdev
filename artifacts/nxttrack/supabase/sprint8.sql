-- ──────────────────────────────────────────────────────────
-- Sprint 8 — Member Management foundation.
--
--   members, member_roles, member_links, groups, group_members,
--   membership_plans, member_memberships, membership_payment_logs
--
-- All tables are tenant-scoped via members.tenant_id /
-- groups.tenant_id / etc. Child tables that don't carry a
-- tenant_id of their own (member_roles, group_members,
-- member_memberships, membership_payment_logs) are protected by
-- joining back to the parent's tenant in the RLS policy.
--
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

-- ── members ───────────────────────────────────────────────
create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  full_name     text not null,
  email         text,
  phone         text,
  member_status text not null default 'prospect',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists members_tenant_idx
  on public.members (tenant_id, created_at desc);
create index if not exists members_tenant_status_idx
  on public.members (tenant_id, member_status);

drop trigger if exists members_updated_at on public.members;
create trigger members_updated_at
  before update on public.members
  for each row execute function public.handle_updated_at();

alter table public.members enable row level security;

drop policy if exists "members_tenant_all" on public.members;
create policy "members_tenant_all" on public.members
  for all
  using      (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- ── member_roles ──────────────────────────────────────────
create table if not exists public.member_roles (
  id        uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  role      text not null,
  unique (member_id, role)
);

create index if not exists member_roles_member_idx
  on public.member_roles (member_id);

alter table public.member_roles enable row level security;

drop policy if exists "member_roles_tenant_all" on public.member_roles;
create policy "member_roles_tenant_all" on public.member_roles
  for all
  using (
    exists (
      select 1 from public.members m
      where m.id = member_roles.member_id
        and public.has_tenant_access(m.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = member_roles.member_id
        and public.has_tenant_access(m.tenant_id)
    )
  );

-- ── member_links (parent ↔ child) ─────────────────────────
create table if not exists public.member_links (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  parent_member_id uuid not null references public.members(id) on delete cascade,
  child_member_id  uuid not null references public.members(id) on delete cascade,
  created_at       timestamptz not null default now(),
  unique (parent_member_id, child_member_id),
  check (parent_member_id <> child_member_id)
);

create index if not exists member_links_tenant_idx
  on public.member_links (tenant_id);
create index if not exists member_links_parent_idx
  on public.member_links (parent_member_id);
create index if not exists member_links_child_idx
  on public.member_links (child_member_id);

alter table public.member_links enable row level security;

drop policy if exists "member_links_tenant_all" on public.member_links;
create policy "member_links_tenant_all" on public.member_links
  for all
  using      (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- ── groups ────────────────────────────────────────────────
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create index if not exists groups_tenant_idx
  on public.groups (tenant_id, name);

alter table public.groups enable row level security;

drop policy if exists "groups_tenant_all" on public.groups;
create policy "groups_tenant_all" on public.groups
  for all
  using      (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- ── group_members ─────────────────────────────────────────
create table if not exists public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, member_id)
);

create index if not exists group_members_group_idx
  on public.group_members (group_id);
create index if not exists group_members_member_idx
  on public.group_members (member_id);

alter table public.group_members enable row level security;

drop policy if exists "group_members_tenant_all" on public.group_members;
create policy "group_members_tenant_all" on public.group_members
  for all
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id
        and public.has_tenant_access(g.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id
        and public.has_tenant_access(g.tenant_id)
    )
  );

-- ── membership_plans ──────────────────────────────────────
create table if not exists public.membership_plans (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  name           text not null,
  price          numeric,
  billing_period text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists membership_plans_tenant_idx
  on public.membership_plans (tenant_id, is_active);

alter table public.membership_plans enable row level security;

drop policy if exists "membership_plans_tenant_all" on public.membership_plans;
create policy "membership_plans_tenant_all" on public.membership_plans
  for all
  using      (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- ── member_memberships ────────────────────────────────────
create table if not exists public.member_memberships (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null references public.members(id) on delete cascade,
  membership_plan_id uuid references public.membership_plans(id) on delete set null,
  start_date         date,
  end_date           date,
  status             text not null default 'active',
  created_at         timestamptz not null default now()
);

create index if not exists member_memberships_member_idx
  on public.member_memberships (member_id, created_at desc);
create index if not exists member_memberships_plan_idx
  on public.member_memberships (membership_plan_id);

alter table public.member_memberships enable row level security;

drop policy if exists "member_memberships_tenant_all" on public.member_memberships;
create policy "member_memberships_tenant_all" on public.member_memberships
  for all
  using (
    exists (
      select 1 from public.members m
      where m.id = member_memberships.member_id
        and public.has_tenant_access(m.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = member_memberships.member_id
        and public.has_tenant_access(m.tenant_id)
    )
  );

-- ── membership_payment_logs ───────────────────────────────
create table if not exists public.membership_payment_logs (
  id                   uuid primary key default gen_random_uuid(),
  member_membership_id uuid not null references public.member_memberships(id) on delete cascade,
  amount               numeric,
  status               text not null default 'due',
  paid_at              timestamptz,
  note                 text,
  created_at           timestamptz not null default now()
);

create index if not exists membership_payment_logs_mm_idx
  on public.membership_payment_logs (member_membership_id, created_at desc);

alter table public.membership_payment_logs enable row level security;

drop policy if exists "membership_payment_logs_tenant_all" on public.membership_payment_logs;
create policy "membership_payment_logs_tenant_all" on public.membership_payment_logs
  for all
  using (
    exists (
      select 1
        from public.member_memberships mm
        join public.members m on m.id = mm.member_id
       where mm.id = membership_payment_logs.member_membership_id
         and public.has_tenant_access(m.tenant_id)
    )
  )
  with check (
    exists (
      select 1
        from public.member_memberships mm
        join public.members m on m.id = mm.member_id
       where mm.id = membership_payment_logs.member_membership_id
         and public.has_tenant_access(m.tenant_id)
    )
  );
