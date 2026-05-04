-- Sprint 16 — Custom roles + permissions per tenant
-- Run AFTER sprint15.sql.

-- ═════════════════════════════════════════════════════════
-- 1. Custom tenant roles
-- ═════════════════════════════════════════════════════════
-- A tenant can define its own roles ("Bestuur", "Hoofdtrainer", …) on top
-- of the built-in member_roles values (parent/athlete/trainer/staff/volunteer).
-- These custom roles carry permission flags used in app-side checks.

create table if not exists public.tenant_roles (
  id           uuid       primary key default gen_random_uuid(),
  tenant_id    uuid       not null references public.tenants(id) on delete cascade,
  name         text       not null,
  description  text,
  is_system    boolean    not null default false,
  sort_order   int        not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists tr_tenant_idx on public.tenant_roles (tenant_id);

drop trigger if exists tr_updated_at on public.tenant_roles;
create trigger tr_updated_at
  before update on public.tenant_roles
  for each row execute function public.handle_updated_at();

alter table public.tenant_roles enable row level security;
drop policy if exists "tr_tenant_all" on public.tenant_roles;
create policy "tr_tenant_all" on public.tenant_roles
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- ═════════════════════════════════════════════════════════
-- 2. Role permissions (one row per granted permission key)
-- ═════════════════════════════════════════════════════════
create table if not exists public.tenant_role_permissions (
  role_id     uuid not null references public.tenant_roles(id) on delete cascade,
  permission  text not null,
  created_at  timestamptz not null default now(),
  primary key (role_id, permission)
);

create index if not exists trp_role_idx on public.tenant_role_permissions (role_id);

alter table public.tenant_role_permissions enable row level security;
drop policy if exists "trp_via_role" on public.tenant_role_permissions;
create policy "trp_via_role" on public.tenant_role_permissions
  for all using (
    exists (
      select 1 from public.tenant_roles r
      where r.id = role_id and public.has_tenant_access(r.tenant_id)
    )
  ) with check (
    exists (
      select 1 from public.tenant_roles r
      where r.id = role_id and public.has_tenant_access(r.tenant_id)
    )
  );

-- ═════════════════════════════════════════════════════════
-- 3. Member ↔ role assignments
-- ═════════════════════════════════════════════════════════
create table if not exists public.tenant_member_roles (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  role_id     uuid not null references public.tenant_roles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (tenant_id, member_id, role_id)
);

create index if not exists tmr_member_idx on public.tenant_member_roles (member_id);
create index if not exists tmr_role_idx   on public.tenant_member_roles (role_id);

alter table public.tenant_member_roles enable row level security;
drop policy if exists "tmr_tenant_all" on public.tenant_member_roles;
create policy "tmr_tenant_all" on public.tenant_member_roles
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- ═════════════════════════════════════════════════════════
-- 4. SQL helper: does the calling user have a permission in a tenant?
-- ═════════════════════════════════════════════════════════
create or replace function public.user_has_tenant_permission(
  target_tenant_id uuid,
  perm text
) returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_platform_admin()
    or public.is_tenant_admin(target_tenant_id)
    or exists (
      select 1
      from public.members m
      join public.tenant_member_roles tmr
        on tmr.member_id = m.id
       and tmr.tenant_id = target_tenant_id
      join public.tenant_roles tr
        on tr.id = tmr.role_id
       and tr.tenant_id = target_tenant_id
      join public.tenant_role_permissions trp on trp.role_id = tr.id
      where m.tenant_id = target_tenant_id
        and m.user_id  = auth.uid()
        and trp.permission = perm
    );
$$;

grant execute on function public.user_has_tenant_permission(uuid, text) to authenticated, anon;
