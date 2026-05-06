-- ──────────────────────────────────────────────────────────
-- Sprint 28 — Audit-log retentiebeleid
--
-- AVG (dataminimalisatie) en kosten/performance: `audit_logs`
-- groeit anders ongelimiteerd. Per tenant configureerbaar,
-- standaard 24 maanden. Een nachtelijke pg_cron job veegt
-- alle rijen ouder dan de tenant-specifieke retentie op.
--
-- Idempotent — veilig om opnieuw te draaien.
-- ──────────────────────────────────────────────────────────

-- 1. Per-tenant retentie (in maanden). NULL = nooit opschonen.
--    Default 24 maanden voor nieuwe én bestaande tenants; admins kunnen
--    de waarde later op NULL zetten als ze events permanent willen bewaren.
--    De kolom is bewust nullable: het "nooit opschonen"-pad is een echt
--    product-keuze (zie UI op /tenant/audit) en geen onbereikbare branche.
alter table public.tenants
  add column if not exists audit_retention_months integer default 24;

-- Sanity-check: alleen positieve waarden of een uitdrukkelijke 0
-- (= meteen opschonen) toestaan; negatief is altijd fout.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'tenants_audit_retention_months_nonneg'
  ) then
    alter table public.tenants
      add constraint tenants_audit_retention_months_nonneg
      check (audit_retention_months >= 0);
  end if;
end$$;

-- 2. Opschoonfunctie. SECURITY DEFINER zodat de cron-job
--    (postgres-rol) ook met RLS aan kan blijven schrijven.
create or replace function public.purge_old_audit_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total_deleted integer := 0;
  tenant_row    record;
  deleted_count integer;
begin
  for tenant_row in
    select id, audit_retention_months
      from public.tenants
     where audit_retention_months is not null
  loop
    delete from public.audit_logs
     where tenant_id  = tenant_row.id
       and created_at < now() - make_interval(months => tenant_row.audit_retention_months);

    get diagnostics deleted_count = row_count;
    total_deleted := total_deleted + deleted_count;
  end loop;

  return total_deleted;
end;
$$;

revoke all on function public.purge_old_audit_logs() from public;
revoke all on function public.purge_old_audit_logs() from anon;
revoke all on function public.purge_old_audit_logs() from authenticated;

-- 3. Nachtelijke schedule via pg_cron (Supabase: extensie staat
--    standaard aan in het `extensions`-schema). We unschedulen
--    eerst een eventuele oudere versie zodat deze migratie
--    idempotent blijft.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
       from cron.job
      where jobname = 'nxttrack_purge_audit_logs';

    perform cron.schedule(
      'nxttrack_purge_audit_logs',
      '17 3 * * *',                        -- elke nacht 03:17 UTC
      $cron$ select public.purge_old_audit_logs(); $cron$
    );
  else
    raise notice 'pg_cron extension not installed — schedule skipped. '
                 'Install via "create extension pg_cron;" or schedule the '
                 'function via a Supabase Edge Function instead.';
  end if;
end$$;
