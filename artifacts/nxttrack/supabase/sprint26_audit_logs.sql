-- ──────────────────────────────────────────────────────────
-- Sprint 26 — Audit-log tabel
--
-- De audit-shim `src/lib/audit/log.ts` schreef tot nu toe alleen
-- naar de console. Deze migratie introduceert de echte tabel
-- waar `recordAudit(...)` naar schrijft. Bestaande call-sites
-- (members.archive, member.unlink_parent_child, financial.update,
--  financial.iban.reveal, payment_method.create/update/archive/
--  unarchive, profile.child.add) gaan automatisch mee.
--
-- RLS: alleen platform-admin en tenant-admin (via bestaande
-- helper `has_tenant_access`) kunnen rijen lezen. Schrijven
-- gebeurt via `createAdminClient()` (service-role bypassed RLS).
--
-- Idempotent — veilig om opnieuw te draaien.
-- ──────────────────────────────────────────────────────────

create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  actor_user_id   uuid references auth.users(id) on delete set null,
  member_id       uuid references public.members(id) on delete set null,
  action          text not null,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists audit_logs_tenant_created_idx
  on public.audit_logs (tenant_id, created_at desc);

create index if not exists audit_logs_tenant_action_idx
  on public.audit_logs (tenant_id, action, created_at desc);

create index if not exists audit_logs_member_idx
  on public.audit_logs (member_id, created_at desc);

alter table public.audit_logs enable row level security;

-- Lezen: tenant-admin (legacy enum + admin-rol via has_tenant_access)
-- of platform-admin. Het service-role pad (recordAudit) bypasst RLS.
drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs
  for select
  using (public.has_tenant_access(tenant_id));

-- Geen insert/update/delete policies → alleen service-role kan schrijven.
revoke all on public.audit_logs from anon;
revoke all on public.audit_logs from public;
grant select on public.audit_logs to authenticated;
