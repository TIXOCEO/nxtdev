-- ──────────────────────────────────────────────────────────
-- Sprint 10 — Onboarding (member invites + auth linking).
--
--   member_invites    (per-tenant invitation tokens)
--   members.user_id   (optional auth user link)
--
-- Tenant-scoped. RLS via has_tenant_access(). Public consumers
-- (the /t/[slug]/invite/[token] page) read invites via the
-- service-role admin client, NOT via this anon RLS policy.
--
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

-- Optional auth-user link on members.
alter table public.members
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists members_user_id_idx
  on public.members (user_id)
  where user_id is not null;

-- ── member_invites ────────────────────────────────────────
create table if not exists public.member_invites (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  member_id       uuid references public.members(id) on delete set null,
  invite_type     text not null,
  -- one of: parent_account | trainer_account | adult_athlete_account
  --        | minor_parent_link | complete_registration | add_existing_minor
  email           text not null,
  full_name       text,
  -- Optional minor reference (for minor_parent_link / add_existing_minor).
  child_member_id uuid references public.members(id) on delete set null,
  -- Cryptographically-random URL-safe token (single-use).
  token           text not null unique,
  -- Short human-readable code (for code-based linking flows).
  invite_code     text not null unique,
  status          text not null default 'pending',
  -- one of: pending | sent | opened | accepted | expired | revoked
  expires_at      timestamptz not null,
  resend_count    int  not null default 0,
  last_sent_at    timestamptz,
  accepted_at     timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists member_invites_tenant_idx
  on public.member_invites (tenant_id, created_at desc);
create index if not exists member_invites_status_idx
  on public.member_invites (tenant_id, status);
create index if not exists member_invites_email_idx
  on public.member_invites (tenant_id, lower(email));
create index if not exists member_invites_token_idx
  on public.member_invites (token);

drop trigger if exists member_invites_updated_at on public.member_invites;
create trigger member_invites_updated_at
  before update on public.member_invites
  for each row execute function public.handle_updated_at();

alter table public.member_invites enable row level security;

drop policy if exists "member_invites_tenant_all" on public.member_invites;
create policy "member_invites_tenant_all" on public.member_invites
  for all
  using      (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));
