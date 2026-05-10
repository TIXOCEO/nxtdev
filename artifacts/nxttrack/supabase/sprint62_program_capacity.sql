-- ═════════════════════════════════════════════════════════════════
-- Sprint 62 — Programs MVP fase 3 (v0.18.0)
--
-- 1. program_membership_plans   join-tabel programs ⇄ membership_plans
-- 2. program_capacity_overview  view  per training_session: fixed/flex/used
--
-- Houtrust-veiligheid:
--   * Geen wijzigingen aan bestaande tabellen.
--   * View toont sessies met OF zonder program_id; program-kolommen
--     zijn dan NULL (geen data-leak, geen gedragsverandering).
--
-- Idempotent: create table if not exists / drop view + create.
-- ═════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. program_membership_plans
--
-- Composite FK's via (program_id, tenant_id) en (membership_plan_id,
-- tenant_id) garanderen schema-niveau-isolatie tussen tenants
-- (Sprint 60-patroon). Een plan mag op meerdere programma's hangen
-- en omgekeerd; binnen één programma mag maximaal één plan
-- gemarkeerd zijn als is_default voor publieke marketplace-flow
-- (Sprint 63 leest dit) en zelf-aanmelding (Sprint 64).
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.program_membership_plans (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  program_id           uuid not null,
  membership_plan_id   uuid not null,
  is_default           boolean not null default false,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'program_membership_plans_program_tenant_fk') then
    alter table public.program_membership_plans
      add constraint program_membership_plans_program_tenant_fk
      foreign key (program_id, tenant_id)
      references public.programs (id, tenant_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'program_membership_plans_plan_tenant_fk') then
    alter table public.program_membership_plans
      add constraint program_membership_plans_plan_tenant_fk
      foreign key (membership_plan_id, tenant_id)
      references public.membership_plans (id, tenant_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'program_membership_plans_uniq') then
    alter table public.program_membership_plans
      add constraint program_membership_plans_uniq
      unique (tenant_id, program_id, membership_plan_id);
  end if;
end $$;

create index if not exists program_membership_plans_program_idx
  on public.program_membership_plans (program_id, sort_order);

create index if not exists program_membership_plans_plan_idx
  on public.program_membership_plans (membership_plan_id);

-- Maximaal één default plan per programma binnen één tenant.
create unique index if not exists program_membership_plans_default_uq
  on public.program_membership_plans (tenant_id, program_id)
  where is_default = true;

alter table public.program_membership_plans enable row level security;

drop policy if exists "program_membership_plans_tenant_all" on public.program_membership_plans;
create policy "program_membership_plans_tenant_all"
  on public.program_membership_plans
  for all
  using (has_tenant_access(tenant_id))
  with check (has_tenant_access(tenant_id));

-- ─────────────────────────────────────────────────────────────────
-- 2. program_capacity_overview — read-only view per training_session
--
-- security_invoker=true zodat tenant-RLS van onderliggende tabellen
-- (training_sessions, groups, programs, group_members,
-- training_attendance, session_resources) van toepassing blijft.
--
-- Capacity-cascade (van specifiek naar generiek):
--   fixed_capacity =
--     coalesce(
--       sum(session_resources.max_participants),  -- specifiek per sessie
--       groups.max_members,                       -- groep-cap
--       programs.default_capacity                 -- program-default
--     )
--   flex_capacity = programs.default_flex_capacity (NULL→0)
--
-- used_count is "verwacht aanwezig" voor niet-afgelaste sessies:
--   * voor sessies in de toekomst   → count(group_members)
--                                     min count(training_attendance
--                                     waar attendance='absent')
--   * voor sessies in het verleden  → count(training_attendance
--                                     waar attendance='present')
-- Beide takken zijn idempotent en niet afhankelijk van tijdzone.
-- ─────────────────────────────────────────────────────────────────
drop view if exists public.program_capacity_overview cascade;

create view public.program_capacity_overview
with (security_invoker = true) as
with session_resource_caps as (
  select sr.session_id,
         sum(sr.max_participants) filter (where sr.max_participants is not null) as resource_cap_sum
  from public.session_resources sr
  group by sr.session_id
),
group_member_counts as (
  select gm.group_id, count(*)::int as member_count
  from public.group_members gm
  group by gm.group_id
),
attendance_present as (
  select ta.session_id, count(*)::int as present_count
  from public.training_attendance ta
  where ta.attendance = 'present'
  group by ta.session_id
),
attendance_absent as (
  select ta.session_id, count(*)::int as absent_count
  from public.training_attendance ta
  where ta.attendance = 'absent'
  group by ta.session_id
)
select
  s.tenant_id,
  s.id                                   as session_id,
  s.title                                as session_title,
  s.starts_at,
  s.ends_at,
  s.status,
  s.group_id,
  g.name                                 as group_name,
  s.program_id,
  p.name                                 as program_name,
  p.visibility                           as program_visibility,
  coalesce(
    src.resource_cap_sum,
    g.max_members,
    p.default_capacity
  )                                       as fixed_capacity,
  case
    when src.resource_cap_sum is not null then 'session_resources'
    when g.max_members is not null         then 'group'
    when p.default_capacity is not null    then 'program'
    else null
  end                                    as fixed_capacity_source,
  coalesce(p.default_flex_capacity, 0)   as flex_capacity,
  case
    when s.starts_at <= now()
      then coalesce(ap.present_count, 0)
      else greatest(
        coalesce(gmc.member_count, 0) - coalesce(aa.absent_count, 0),
        0
      )
  end                                    as used_count,
  coalesce(p.capacity_purpose_defaults_json, '{}'::jsonb)
                                          as purpose_breakdown_json
from public.training_sessions s
left join public.groups   g on g.id = s.group_id
left join public.programs p on p.id = s.program_id
left join session_resource_caps  src on src.session_id = s.id
left join group_member_counts    gmc on gmc.group_id  = s.group_id
left join attendance_present     ap  on ap.session_id  = s.id
left join attendance_absent      aa  on aa.session_id  = s.id
where s.status <> 'cancelled';

comment on view public.program_capacity_overview is
  'Sprint 62: per-session capacity overview. fixed/flex/used cascade '
  'session_resources → groups → programs. security_invoker=true zodat '
  'tenant-RLS gerespecteerd blijft.';

grant select on public.program_capacity_overview to authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 3. set_program_default_plan — atomische default-switch.
--
-- Eén UPDATE-statement zet de target op true en alle andere rijen
-- binnen (tenant, program) op false. Postgres evalueert de partial
-- unique index aan het einde van het statement, dus dit is veilig.
--
-- security_invoker via SECURITY INVOKER (default) zodat de RLS-
-- policy van de aanroeper telt — alleen tenant-admins kunnen
-- mutaties doen op program_membership_plans.
--
-- Returnt true als de target-rij bestond (en dus default werd),
-- false anders. Caller hoeft niet vooraf te SELECT'en.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.set_program_default_plan(
  p_tenant  uuid,
  p_program uuid,
  p_plan    uuid
) returns boolean
language plpgsql
security invoker
as $$
declare
  v_hit int;
begin
  update public.program_membership_plans
     set is_default = (membership_plan_id = p_plan)
   where tenant_id  = p_tenant
     and program_id = p_program;

  select count(*) into v_hit
    from public.program_membership_plans
   where tenant_id        = p_tenant
     and program_id       = p_program
     and membership_plan_id = p_plan;

  return v_hit > 0;
end $$;

grant execute on function public.set_program_default_plan(uuid, uuid, uuid) to authenticated;
