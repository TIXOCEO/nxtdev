-- ──────────────────────────────────────────────────────────
-- Sprint 23 — Onboarding foundation
--
-- Schema-only sprint dat de basis legt voor de complete
-- onboarding-rebuild (Sprint B-G). Idempotent — veilig om
-- meerdere keren te draaien. Geen destructieve drops.
--
-- Inhoud:
--   1. members: gestructureerde naam-/persoons-/adresvelden,
--      account_type enum, soft-delete kolommen
--   2. members: status check uitgebreid (invited/aspirant/...)
--   3. members_active view (helper, geen RLS-wijziging)
--   4. member_invites.prefill_data jsonb
--   5. member_financial_details (per-member, IBAN + payment_method)
--   6. payment_methods (per-tenant CRUD)
--   7. Default systeemrollen "Staf" en "Trainer" per tenant
--      (scope='admin', is_super_admin=false, NUL permissies)
--   8. Trigger sync_staff_trainer_role: koppelt staff/trainer
--      members met user_id automatisch aan de juiste systeemrol
--      via tenant_member_roles (idempotent ON CONFLICT)
--   9. Trigger sync_member_full_name: houdt full_name in sync
--      met first_name/last_name zodra die gevuld zijn
--
-- Run AFTER sprint22_roles_scope_grid.sql.
-- ──────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════
-- 1. members — uitbreidingen
-- ═════════════════════════════════════════════════════════
alter table public.members
  add column if not exists first_name    text,
  add column if not exists last_name     text,
  add column if not exists birth_date    date,
  add column if not exists gender        text,
  add column if not exists player_type   text,
  add column if not exists account_type  text,
  add column if not exists street        text,
  add column if not exists house_number  text,
  add column if not exists postal_code   text,
  add column if not exists city          text,
  add column if not exists archived_at   timestamptz,
  add column if not exists archived_by   uuid references auth.users(id) on delete set null;

-- Check-constraints (drop+add zodat herloop hetzelfde gedrag geeft).
alter table public.members drop constraint if exists members_account_type_chk;
alter table public.members
  add constraint members_account_type_chk
  check (account_type is null or account_type in (
    'athlete','minor_athlete','parent','trainer','staff'
  ));

alter table public.members drop constraint if exists members_gender_chk;
alter table public.members
  add constraint members_gender_chk
  check (gender is null or gender in ('male','female','other'));

alter table public.members drop constraint if exists members_player_type_chk;
alter table public.members
  add constraint members_player_type_chk
  check (player_type is null or player_type in ('player','goalkeeper'));

create index if not exists members_account_type_idx
  on public.members (tenant_id, account_type);
create index if not exists members_archived_idx
  on public.members (tenant_id, archived_at);

-- ═════════════════════════════════════════════════════════
-- 2. members.member_status — uitgebreide check
-- ═════════════════════════════════════════════════════════
alter table public.members drop constraint if exists members_member_status_chk;
alter table public.members
  add constraint members_member_status_chk
  check (member_status in (
    -- legacy waarden (sprint 8/9 + member_memberships): blijven geldig
    'prospect','new','contacted','accepted','rejected','paused','cancelled',
    -- sprint 23: canonieke set
    'invited','aspirant','pending','active','inactive','archived'
  ));

-- ═════════════════════════════════════════════════════════
-- 3. Backfill: full_name → first_name/last_name (alleen als leeg)
-- ═════════════════════════════════════════════════════════
update public.members
   set first_name = case
         when position(' ' in trim(full_name)) > 0
           then split_part(trim(full_name), ' ', 1)
         else trim(full_name)
       end,
       last_name = case
         when position(' ' in trim(full_name)) > 0
           then trim(substring(trim(full_name) from position(' ' in trim(full_name)) + 1))
         else null
       end
 where (first_name is null or first_name = '')
   and (last_name is null);

-- Backfill account_type uit member_roles (alleen als leeg).
update public.members m
   set account_type = case
     when exists (select 1 from public.member_roles r where r.member_id = m.id and r.role = 'parent')  then 'parent'
     when exists (select 1 from public.member_roles r where r.member_id = m.id and r.role = 'trainer') then 'trainer'
     when exists (select 1 from public.member_roles r where r.member_id = m.id and r.role = 'staff')   then 'staff'
     when exists (select 1 from public.member_roles r where r.member_id = m.id and r.role = 'athlete')
       then case
              when m.birth_date is not null and age(m.birth_date) < interval '18 years'
                then 'minor_athlete'
              else 'athlete'
            end
     else null
   end
 where account_type is null;

-- ═════════════════════════════════════════════════════════
-- 4. members_active view (geen RLS-wijziging op members zelf)
-- ═════════════════════════════════════════════════════════
create or replace view public.members_active as
  select * from public.members where archived_at is null;

-- ═════════════════════════════════════════════════════════
-- 5. Trigger: sync full_name uit first_name + last_name
-- ═════════════════════════════════════════════════════════
create or replace function public.sync_member_full_name()
returns trigger
language plpgsql as $$
declare
  combined text;
begin
  if new.first_name is not null or new.last_name is not null then
    combined := nullif(trim(coalesce(new.first_name,'') || ' ' || coalesce(new.last_name,'')), '');
    if combined is not null then
      new.full_name := combined;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists members_sync_full_name on public.members;
create trigger members_sync_full_name
  before insert or update of first_name, last_name on public.members
  for each row execute function public.sync_member_full_name();

-- ═════════════════════════════════════════════════════════
-- 6. member_invites.prefill_data
-- ═════════════════════════════════════════════════════════
alter table public.member_invites
  add column if not exists prefill_data jsonb;

-- ═════════════════════════════════════════════════════════
-- 7. member_financial_details
--    Per-member 1:1 record. IBAN/account-holder/payment-method.
--    RLS: tenant-admin met permissie 'members.financial.view'
--    of de member zelf (auth.uid() = members.user_id).
-- ═════════════════════════════════════════════════════════
create table if not exists public.member_financial_details (
  member_id           uuid primary key references public.members(id) on delete cascade,
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  iban                text,
  account_holder_name text,
  payment_method_id   uuid,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists mfd_tenant_idx on public.member_financial_details (tenant_id);

drop trigger if exists mfd_updated_at on public.member_financial_details;
create trigger mfd_updated_at
  before update on public.member_financial_details
  for each row execute function public.handle_updated_at();

alter table public.member_financial_details enable row level security;

-- Tenant-consistency trigger: garandeert dat row.tenant_id altijd
-- gelijk is aan members.tenant_id (voorkomt cross-tenant smokkel via RLS).
create or replace function public.enforce_mfd_tenant_consistency()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m_tenant uuid;
  pm_tenant uuid;
begin
  select tenant_id into m_tenant from public.members where id = new.member_id;
  if m_tenant is null then
    raise exception 'member_financial_details: member_id % not found', new.member_id;
  end if;
  -- Forceer tenant_id naar de tenant van de member.
  new.tenant_id := m_tenant;

  if new.payment_method_id is not null then
    select tenant_id into pm_tenant from public.payment_methods where id = new.payment_method_id;
    if pm_tenant is null or pm_tenant <> m_tenant then
      raise exception 'member_financial_details: payment_method_id % belongs to a different tenant', new.payment_method_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mfd_enforce_tenant on public.member_financial_details;
create trigger mfd_enforce_tenant
  before insert or update on public.member_financial_details
  for each row execute function public.enforce_mfd_tenant_consistency();

-- RLS: member zelf (member.user_id = auth.uid AND member.tenant_id = row.tenant_id)
-- of tenant-admin met expliciete permissie.
drop policy if exists "mfd_self_or_admin_select" on public.member_financial_details;
create policy "mfd_self_or_admin_select" on public.member_financial_details
  for select using (
    public.user_has_tenant_permission(tenant_id, 'members.financial.view')
    or exists (
      select 1 from public.members m
       where m.id = member_financial_details.member_id
         and m.tenant_id = member_financial_details.tenant_id
         and m.user_id = auth.uid()
    )
  );

drop policy if exists "mfd_self_or_admin_modify" on public.member_financial_details;
create policy "mfd_self_or_admin_modify" on public.member_financial_details
  for all using (
    public.user_has_tenant_permission(tenant_id, 'members.financial.manage')
    or exists (
      select 1 from public.members m
       where m.id = member_financial_details.member_id
         and m.tenant_id = member_financial_details.tenant_id
         and m.user_id = auth.uid()
    )
  ) with check (
    public.user_has_tenant_permission(tenant_id, 'members.financial.manage')
    or exists (
      select 1 from public.members m
       where m.id = member_financial_details.member_id
         and m.tenant_id = member_financial_details.tenant_id
         and m.user_id = auth.uid()
    )
  );

-- ═════════════════════════════════════════════════════════
-- 8. payment_methods (per tenant)
-- ═════════════════════════════════════════════════════════
create table if not exists public.payment_methods (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text not null,
  type         text not null,
  description  text,
  iban_for_rekening text,
  sort_order   int not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.payment_methods drop constraint if exists payment_methods_type_chk;
alter table public.payment_methods
  add constraint payment_methods_type_chk
  check (type in ('contant','rekening','incasso','overig'));

create index if not exists payment_methods_tenant_idx
  on public.payment_methods (tenant_id, archived_at, sort_order);

drop trigger if exists payment_methods_updated_at on public.payment_methods;
create trigger payment_methods_updated_at
  before update on public.payment_methods
  for each row execute function public.handle_updated_at();

alter table public.payment_methods enable row level security;

drop policy if exists "payment_methods_tenant_all" on public.payment_methods;
create policy "payment_methods_tenant_all" on public.payment_methods
  for all
  using      (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- FK voor financial_details.payment_method_id (apart toevoegen zodat tabel-volgorde
-- niet uitmaakt bij herloop).
alter table public.member_financial_details
  drop constraint if exists mfd_payment_method_fk;
alter table public.member_financial_details
  add constraint mfd_payment_method_fk
  foreign key (payment_method_id) references public.payment_methods(id) on delete set null;

-- ═════════════════════════════════════════════════════════
-- 9. Seed default systeemrollen "Staf" + "Trainer" per tenant
--    scope='admin', is_super_admin=false, ZERO permissions.
--    De Sprint 22 unique index (tenant_id, scope, name) zorgt
--    voor idempotency.
-- ═════════════════════════════════════════════════════════
insert into public.tenant_roles (tenant_id, name, description, is_system, sort_order, scope, is_super_admin)
select t.id, 'Staf',
       'Standaard staf-rol — toegang tot admin-dashboard zonder permissies. Beheerder kent rechten toe.',
       true, 100, 'admin', false
  from public.tenants t
on conflict do nothing;

insert into public.tenant_roles (tenant_id, name, description, is_system, sort_order, scope, is_super_admin)
select t.id, 'Trainer',
       'Standaard trainer-rol — toegang tot admin-dashboard zonder permissies. Beheerder kent rechten toe.',
       true, 101, 'admin', false
  from public.tenants t
on conflict do nothing;

-- ═════════════════════════════════════════════════════════
-- 10. Trigger: koppel staff/trainer members automatisch aan
--     de juiste systeemrol zodra ze een user_id hebben.
--     Geen permissies → leeg admin-dashboard tot een beheerder
--     via de Sprint 22 grid rechten toekent.
-- ═════════════════════════════════════════════════════════
create or replace function public.sync_staff_trainer_role()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_role_name text;
  target_role_id uuid;
begin
  if new.user_id is null then
    return new;
  end if;
  if new.account_type is null or new.account_type not in ('staff','trainer') then
    return new;
  end if;
  target_role_name := case new.account_type
                        when 'staff'   then 'Staf'
                        when 'trainer' then 'Trainer'
                      end;

  select id into target_role_id
    from public.tenant_roles
   where tenant_id     = new.tenant_id
     and name          = target_role_name
     and scope         = 'admin'
     and is_system     = true
   limit 1;

  if target_role_id is null then
    return new;
  end if;

  insert into public.tenant_member_roles (tenant_id, member_id, role_id)
       values (new.tenant_id, new.id, target_role_id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists members_sync_staff_trainer on public.members;
create trigger members_sync_staff_trainer
  after insert or update of account_type, user_id on public.members
  for each row execute function public.sync_staff_trainer_role();

-- One-shot backfill voor bestaande members met account_type staff/trainer en user_id.
do $$
declare
  m record;
  r_id uuid;
  r_name text;
begin
  for m in
    select id, tenant_id, account_type, user_id
      from public.members
     where user_id is not null
       and account_type in ('staff','trainer')
  loop
    r_name := case m.account_type when 'staff' then 'Staf' when 'trainer' then 'Trainer' end;
    select id into r_id
      from public.tenant_roles
     where tenant_id = m.tenant_id
       and name = r_name
       and scope = 'admin'
       and is_system = true
     limit 1;
    if r_id is not null then
      insert into public.tenant_member_roles (tenant_id, member_id, role_id)
           values (m.tenant_id, m.id, r_id)
      on conflict do nothing;
    end if;
  end loop;
end$$;

-- Einde sprint23.
