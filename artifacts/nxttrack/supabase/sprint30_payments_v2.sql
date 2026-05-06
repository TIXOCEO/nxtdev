-- Sprint 30 — Abonnementen & betalingen v2
-- Doel:
--   • Tenant-defaults op membership_plans + payment_methods (radio-gedrag,
--     enforced via partial unique index per tenant).
--   • membership_payment_logs uitgebreid met period, due_date,
--     amount_expected/amount_paid, plan/methode-snapshot, parent_payment_id.
--   • membership_payment_audit (verplichte notitie bij wijzigen/verwijderen).
--   • member_memberships kan beëindigd worden (status='ended', ended_at,
--     end_reason).
-- Run AFTER sprint29_homepage_modules_v2.sql. Idempotent.

-- ───────────────────────────────────────────────────────────────
-- 1. Defaults op membership_plans
-- ───────────────────────────────────────────────────────────────
alter table public.membership_plans
  add column if not exists is_default boolean not null default false;

drop index if exists membership_plans_default_uniq;
create unique index membership_plans_default_uniq
  on public.membership_plans (tenant_id)
  where is_default = true;

-- ───────────────────────────────────────────────────────────────
-- 2. Defaults op payment_methods
-- ───────────────────────────────────────────────────────────────
alter table public.payment_methods
  add column if not exists is_default boolean not null default false;

drop index if exists payment_methods_default_uniq;
create unique index payment_methods_default_uniq
  on public.payment_methods (tenant_id)
  where is_default = true and archived_at is null;

-- ───────────────────────────────────────────────────────────────
-- 3. membership_payment_logs uitbreiden
-- ───────────────────────────────────────────────────────────────
alter table public.membership_payment_logs
  add column if not exists amount_expected         numeric,
  add column if not exists amount_paid             numeric,
  add column if not exists period                  text,
  add column if not exists due_date                date,
  add column if not exists paid_via_payment_method_id uuid
      references public.payment_methods(id) on delete set null,
  add column if not exists membership_plan_id      uuid
      references public.membership_plans(id) on delete set null,
  add column if not exists parent_payment_id       uuid
      references public.membership_payment_logs(id) on delete set null,
  -- Bewaart de oorspronkelijke deelbetaling op een parent-rij voordat
  -- restant-boekingen het totaal optellen. Hiermee kunnen we parent
  -- amount_paid herberekenen uit (original + sum(children)) zonder
  -- de historische deelbetaling te verliezen.
  add column if not exists original_amount_paid   numeric;

-- Backfill: bestaande rijen worden behandeld als volledig betaald.
update public.membership_payment_logs
   set amount_paid = coalesce(amount_paid, amount),
       amount_expected = coalesce(amount_expected, amount)
 where amount_paid is null or amount_expected is null;

-- Status check uitbreiden naar de nieuwe lifecycle.
alter table public.membership_payment_logs
  drop constraint if exists membership_payment_logs_status_chk;
alter table public.membership_payment_logs
  add constraint membership_payment_logs_status_chk
  check (status in ('paid','due','partial','overdue','waived','refunded','cancelled'));

-- Period check (alleen drie waarden in de UI).
alter table public.membership_payment_logs
  drop constraint if exists membership_payment_logs_period_chk;
alter table public.membership_payment_logs
  add constraint membership_payment_logs_period_chk
  check (period is null or period in ('maand','jaar','anders'));

create index if not exists membership_payment_logs_due_idx
  on public.membership_payment_logs (member_membership_id, due_date);

-- ───────────────────────────────────────────────────────────────
-- 4. membership_payment_audit
-- ───────────────────────────────────────────────────────────────
-- payment_id is nullable + ON DELETE SET NULL: audit-rijen blijven bestaan
-- nadat de bron-rij verwijderd wordt, zodat de "deleted" notitie zichtbaar
-- blijft. De volledige snapshot van de bron-rij staat in `before`-jsonb.
create table if not exists public.membership_payment_audit (
  id              uuid primary key default gen_random_uuid(),
  payment_id      uuid references public.membership_payment_logs(id) on delete set null,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  actor_user_id   uuid references auth.users(id) on delete set null,
  action          text not null check (action in ('updated','deleted')),
  note            text not null,
  before          jsonb,
  after           jsonb,
  created_at      timestamptz not null default now()
);

-- Idempotente migratie van een eerdere variant met NOT NULL + cascade.
alter table public.membership_payment_audit
  alter column payment_id drop not null;
do $$
begin
  alter table public.membership_payment_audit
    drop constraint membership_payment_audit_payment_id_fkey;
exception when undefined_object then null;
end $$;
alter table public.membership_payment_audit
  add constraint membership_payment_audit_payment_id_fkey
  foreign key (payment_id) references public.membership_payment_logs(id) on delete set null;

create index if not exists membership_payment_audit_payment_idx
  on public.membership_payment_audit (payment_id, created_at desc);
create index if not exists membership_payment_audit_tenant_idx
  on public.membership_payment_audit (tenant_id, created_at desc);

alter table public.membership_payment_audit enable row level security;

drop policy if exists "membership_payment_audit_tenant_admin_read"
  on public.membership_payment_audit;
create policy "membership_payment_audit_tenant_admin_read"
  on public.membership_payment_audit
  for select
  using (public.has_tenant_access(tenant_id));

-- Schrijven gaat altijd via service-role helper (recordPaymentAudit) zodat
-- RLS op de write-pad geen rol speelt.

-- ───────────────────────────────────────────────────────────────
-- 4b. Atomische helpers voor default-switch (één SQL-functie =
--     impliciete transactie). Hiermee blijft de tenant nooit
--     "zonder default" hangen wanneer een van de twee statements faalt.
-- ───────────────────────────────────────────────────────────────
create or replace function public.set_membership_plan_default(
  p_tenant_id uuid,
  p_plan_id   uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.membership_plans
     where id = p_plan_id and tenant_id = p_tenant_id and is_active
  ) then
    raise exception 'Plan % hoort niet bij tenant % of is inactief',
      p_plan_id, p_tenant_id;
  end if;
  update public.membership_plans
     set is_default = false
   where tenant_id = p_tenant_id and is_default = true;
  update public.membership_plans
     set is_default = true
   where tenant_id = p_tenant_id and id = p_plan_id;
end;
$$;

create or replace function public.set_payment_method_default(
  p_tenant_id uuid,
  p_method_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.payment_methods
     where id = p_method_id
       and tenant_id = p_tenant_id
       and archived_at is null
  ) then
    raise exception 'Methode % hoort niet bij tenant % of is gearchiveerd',
      p_method_id, p_tenant_id;
  end if;
  update public.payment_methods
     set is_default = false
   where tenant_id = p_tenant_id and is_default = true;
  update public.payment_methods
     set is_default = true
   where tenant_id = p_tenant_id and id = p_method_id;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 5. member_memberships: beëindigen
-- ───────────────────────────────────────────────────────────────
alter table public.member_memberships
  add column if not exists ended_at   timestamptz,
  add column if not exists end_reason text;

alter table public.member_memberships
  drop constraint if exists member_memberships_status_chk;
alter table public.member_memberships
  add constraint member_memberships_status_chk
  check (status in ('active','paused','ended','cancelled'));
