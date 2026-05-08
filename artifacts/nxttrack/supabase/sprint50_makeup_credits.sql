-- ──────────────────────────────────────────────────────────
-- Sprint 50 — Inhaallessen (credits + verzoeken)
--
-- Géén automatische auto-grant trigger in deze sprint. Tenant-admins
-- maken credits handmatig aan, of accepteren een verzoek dat de leerling
-- via de portal indient. Auto-grant bij absentie volgt als follow-up.
--
-- RLS: tenant-admin via has_tenant_access; member-read voor eigen credits.
--
-- Volledig idempotent.
-- ──────────────────────────────────────────────────────────

create table if not exists public.makeup_credits (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  member_id    uuid        not null references public.members(id) on delete cascade,
  reason       text,
  source_session_id uuid   references public.training_sessions(id) on delete set null,
  granted_by   uuid        references auth.users(id) on delete set null,
  expires_at   timestamptz,
  status       text        not null default 'open'
                check (status in ('open','reserved','consumed','expired','revoked')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists makeup_credits_member_idx
  on public.makeup_credits (tenant_id, member_id, status, created_at desc);

drop trigger if exists makeup_credits_updated_at on public.makeup_credits;
create trigger makeup_credits_updated_at
  before update on public.makeup_credits
  for each row execute function public.handle_updated_at();

alter table public.makeup_credits enable row level security;

drop policy if exists "makeup_credits_tenant_all"  on public.makeup_credits;
drop policy if exists "makeup_credits_member_read" on public.makeup_credits;

create policy "makeup_credits_tenant_all" on public.makeup_credits
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Lid mag eigen credits + die van gekoppeld kind lezen.
create policy "makeup_credits_member_read" on public.makeup_credits
  for select
  using (
    exists (
      select 1 from public.members m
       where m.id = makeup_credits.member_id
         and m.tenant_id = makeup_credits.tenant_id
         and m.user_id = auth.uid()
    )
    or exists (
      select 1
        from public.member_links ml
        join public.members p on p.id = ml.parent_member_id
       where ml.child_member_id = makeup_credits.member_id
         and p.tenant_id = makeup_credits.tenant_id
         and p.user_id = auth.uid()
    )
  );

-- ── Verzoeken (lid claimt een credit op een specifieke sessie) ─────
create table if not exists public.makeup_requests (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants(id) on delete cascade,
  member_id       uuid        not null references public.members(id) on delete cascade,
  credit_id       uuid        references public.makeup_credits(id) on delete set null,
  target_session_id uuid      not null references public.training_sessions(id) on delete cascade,
  status          text        not null default 'pending'
                  check (status in ('pending','approved','declined','cancelled','attended','no_show')),
  requested_by    uuid        references auth.users(id) on delete set null,
  decided_by      uuid        references auth.users(id) on delete set null,
  decided_at      timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists makeup_requests_session_idx
  on public.makeup_requests (target_session_id, status);
create index if not exists makeup_requests_member_idx
  on public.makeup_requests (tenant_id, member_id, status, created_at desc);

drop trigger if exists makeup_requests_updated_at on public.makeup_requests;
create trigger makeup_requests_updated_at
  before update on public.makeup_requests
  for each row execute function public.handle_updated_at();

alter table public.makeup_requests enable row level security;

drop policy if exists "makeup_requests_tenant_all"  on public.makeup_requests;
drop policy if exists "makeup_requests_member_rw"   on public.makeup_requests;

create policy "makeup_requests_tenant_all" on public.makeup_requests
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Lid (of ouder) mag eigen verzoeken lezen.
create policy "makeup_requests_member_rw" on public.makeup_requests
  for select
  using (
    exists (
      select 1 from public.members m
       where m.id = makeup_requests.member_id
         and m.tenant_id = makeup_requests.tenant_id
         and m.user_id = auth.uid()
    )
    or exists (
      select 1
        from public.member_links ml
        join public.members p on p.id = ml.parent_member_id
       where ml.child_member_id = makeup_requests.member_id
         and p.tenant_id = makeup_requests.tenant_id
         and p.user_id = auth.uid()
    )
  );
