-- Sprint 22 — Role scopes (admin/usershell), super-admin flag, 2D module grid.
-- Run AFTER sprint21.sql.  Idempotent: safe to re-run.

-- ═════════════════════════════════════════════════════════
-- 1. tenant_roles: scope + is_super_admin
-- ═════════════════════════════════════════════════════════
alter table public.tenant_roles
  add column if not exists scope text not null default 'admin'
    check (scope in ('admin','usershell'));

alter table public.tenant_roles
  add column if not exists is_super_admin boolean not null default false;

-- Replace per-tenant unique(name) with per-(tenant,scope) unique(name) so
-- the same name can exist in both an admin and usershell context.
alter table public.tenant_roles drop constraint if exists tenant_roles_tenant_id_name_key;
create unique index if not exists tenant_roles_tenant_scope_name_uq
  on public.tenant_roles (tenant_id, scope, name);

-- Bestaande rollen (van vorige sprint) waren admin-scope. Defaults dekken dit.
-- Markeer een eventueel reeds aangemaakte "Beheerder/Super admin" rol expliciet.
update public.tenant_roles
  set is_super_admin = true
  where is_system = true
    and sort_order = 0
    and name in ('Beheerder','Super admin')
    and is_super_admin = false;

-- ═════════════════════════════════════════════════════════
-- 2. tenant_modules: 2D grid coordinates (position_x, position_y, w, h)
--    Behoud `position` voor terugwaartse compatibiliteit; nieuwe x/y/w/h
--    zijn leidend voor het rendertype "2D grid" in de admin/public.
-- ═════════════════════════════════════════════════════════
alter table public.tenant_modules
  add column if not exists position_x int not null default 0
    check (position_x >= 0 and position_x <= 1);

alter table public.tenant_modules
  add column if not exists position_y int not null default 0
    check (position_y >= 0);

alter table public.tenant_modules
  add column if not exists w int not null default 1
    check (w in (1, 2));

alter table public.tenant_modules
  add column if not exists h int not null default 1
    check (h in (1, 2));

-- Een 2x... module moet altijd op kolom 0 starten (full-width).
alter table public.tenant_modules drop constraint if exists tenant_modules_w2_x0_chk;
alter table public.tenant_modules
  add constraint tenant_modules_w2_x0_chk check (w = 1 or position_x = 0);

create index if not exists idx_tenant_modules_xy
  on public.tenant_modules (tenant_id, position_y, position_x);

-- Eénmalige initialisatie van x/y/w/h op basis van de oude `position` +
-- `size`-kolom voor tenants die al modules hadden (sprint 18).
do $$
declare
  rec record;
  cur_y int;
  cur_x int;
  next_y int;
  next_x int;
  mw int;
  mh int;
begin
  for rec in
    select tenant_id from public.tenant_modules
      where (position_x = 0 and position_y = 0 and w = 1 and h = 1)
      group by tenant_id
  loop
    cur_y := 0;
    cur_x := 0;
    for rec in
      select id, size, module_key, position
        from public.tenant_modules
        where tenant_id = rec.tenant_id
        order by position
    loop
      mw := case
        when rec.size = '2x1' then 2
        when rec.module_key in ('hero_slider','news_hero_slider') then 2
        else 1
      end;
      mh := case when rec.size = '1x2' then 2 else 1 end;

      -- Wide tile? Dan eerst eventuele halve rij sluiten.
      if mw = 2 and cur_x = 1 then
        cur_y := cur_y + 1;
        cur_x := 0;
      end if;

      update public.tenant_modules
        set position_x = cur_x, position_y = cur_y, w = mw, h = mh
        where id = rec.id;

      if mw = 2 then
        cur_y := cur_y + mh;
        cur_x := 0;
      else
        if cur_x = 0 then
          cur_x := 1;
        else
          cur_x := 0;
          cur_y := cur_y + 1;
        end if;
      end if;
    end loop;
  end loop;
end$$;

-- ═════════════════════════════════════════════════════════
-- 3. Admin-toegang via tenant_role met scope='admin'
--    (naast de bestaande tenant_memberships.role='tenant_admin').
-- ═════════════════════════════════════════════════════════
create or replace function public.user_has_tenant_admin_role(target_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.members m
      join public.tenant_member_roles tmr
        on tmr.member_id = m.id
       and tmr.tenant_id = target_tenant_id
      join public.tenant_roles tr
        on tr.id = tmr.role_id
       and tr.tenant_id = target_tenant_id
      where m.tenant_id = target_tenant_id
        and m.user_id  = auth.uid()
        and tr.scope = 'admin'
  );
$$;

grant execute on function public.user_has_tenant_admin_role(uuid) to authenticated;

-- has_tenant_access uitbreiden zodat ook admin-rollen via tenant_member_roles
-- toegang geven. Bestaande callers (RLS-policies) blijven werken.
create or replace function public.has_tenant_access(target_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_platform_admin()
    or public.is_tenant_admin(target_tenant_id)
    or public.user_has_tenant_admin_role(target_tenant_id);
$$;

grant execute on function public.has_tenant_access(uuid) to authenticated, anon;
