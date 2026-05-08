-- ──────────────────────────────────────────────────────────
-- Sprint 52 — Mijlpalen (diploma-readiness)
--
-- Een mijlpaal koppelt een drempel-percentage aan een module: zodra een
-- lid X% van de items in die module met een 'sterk' label heeft, telt
-- de mijlpaal als 'klaar'. Welke labels meetellen wordt voorlopig
-- bepaald door label.sort_order >= 4 (sterk + klaar) — een
-- materialized view + per-mijlpaal label-set volgt later.
--
-- Volledig idempotent.
-- ──────────────────────────────────────────────────────────

create table if not exists public.milestones (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants(id) on delete cascade,
  module_id       uuid        not null references public.progress_modules(id) on delete cascade,
  slug            text        not null,
  name            text        not null,
  description     text,
  required_percent int        not null default 100
                   check (required_percent between 1 and 100),
  is_active       boolean     not null default true,
  sort_order      int         not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (module_id, slug)
);

create index if not exists milestones_tenant_idx on public.milestones (tenant_id, sort_order);

drop trigger if exists milestones_updated_at on public.milestones;
create trigger milestones_updated_at
  before update on public.milestones
  for each row execute function public.handle_updated_at();

alter table public.milestones enable row level security;

drop policy if exists "milestones_tenant_all"  on public.milestones;
drop policy if exists "milestones_member_read" on public.milestones;

create policy "milestones_tenant_all" on public.milestones
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

create policy "milestones_member_read" on public.milestones
  for select
  using (
    exists (
      select 1 from public.members m
       where m.tenant_id = milestones.tenant_id
         and m.user_id   = auth.uid()
    )
  );

-- ── View: readiness per (tenant, milestone, member) ──────────────
-- "Sterk-of-meer" = label met sort_order >= 4 (Sterk / Klaar in de
-- standaard 5-stappen-set). Tenant-admins die hun eigen labels herordenen
-- moeten daar bij stilstaan; een per-mijlpaal label-set volgt in een
-- follow-up.
create or replace view public.milestone_readiness as
  with totals as (
    select pm.tenant_id,
           m.id  as milestone_id,
           pi.id as item_id
      from public.milestones m
      join public.progress_modules    pm on pm.id = m.module_id
      join public.progress_categories pc on pc.module_id = pm.id
      join public.progress_items      pi on pi.category_id = pc.id
  ),
  per_member as (
    select t.tenant_id,
           t.milestone_id,
           mem.id as member_id,
           t.item_id,
           pml.label_id is not null
             and exists (
               select 1 from public.scoring_labels sl
                where sl.id = pml.label_id
                  and sl.sort_order >= 4
             ) as is_strong
      from totals t
      cross join lateral (
        select id from public.members
         where tenant_id = t.tenant_id
      ) mem
      left join public.progress_member_latest pml
        on pml.tenant_id = t.tenant_id
       and pml.member_id = mem.id
       and pml.item_id   = t.item_id
  )
  select tenant_id,
         milestone_id,
         member_id,
         count(*)                                                   as item_count,
         sum(case when is_strong then 1 else 0 end)                 as strong_count,
         case when count(*) = 0 then 0
              else round(100.0 * sum(case when is_strong then 1 else 0 end) / count(*))
         end                                                        as percent_complete
    from per_member
   group by tenant_id, milestone_id, member_id;
