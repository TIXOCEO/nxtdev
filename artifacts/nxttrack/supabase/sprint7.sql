-- ──────────────────────────────────────────────────────────
-- Sprint 7 — extend public.registrations to support two
-- public form types (proefles/tryout + aspirant inschrijving).
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

alter table public.registrations
  add column if not exists type                text   default 'registration',
  add column if not exists membership_status   text   default 'new',
  add column if not exists registration_target text,
  add column if not exists address             text,
  add column if not exists postal_code         text,
  add column if not exists city                text,
  add column if not exists date_of_birth       date,
  add column if not exists player_type         text,
  add column if not exists agreed_terms        boolean default false,
  add column if not exists extra_details       text,
  add column if not exists athletes_json       jsonb   default '[]'::jsonb;

-- One-time backfill: a fresh `add column ... default 'new'` populates every
-- existing row with 'new', which would otherwise hide the original status
-- (e.g. 'contacted', 'rejected') from the type-aware admin select. Copy any
-- non-default legacy status into membership_status. Subsequent runs are
-- no-ops because membership_status is already populated.
update public.registrations
   set membership_status = status
 where membership_status = 'new'
   and status is not null
   and status <> 'new';

-- The legacy NOT NULL constraints on parent_name and child_name are no
-- longer appropriate (self-registrations and tryouts may not have a
-- separate child). DROP NOT NULL is idempotent — running it on an already
-- nullable column is a no-op, so no DO block is needed.
alter table public.registrations alter column parent_name drop not null;
alter table public.registrations alter column child_name  drop not null;

-- RLS policies (idempotent). Public can insert; tenant admins (and
-- platform admins via has_tenant_access) can read/update their own.
drop policy if exists "registrations_public_insert" on public.registrations;
create policy "registrations_public_insert" on public.registrations
  for insert with check (true);

drop policy if exists "registrations_tenant_all" on public.registrations;
create policy "registrations_tenant_all" on public.registrations
  for all
  using      (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- Helpful indexes for admin filtering.
create index if not exists registrations_tenant_type_idx
  on public.registrations (tenant_id, type, created_at desc);

create index if not exists registrations_tenant_status_idx
  on public.registrations (tenant_id, membership_status);
