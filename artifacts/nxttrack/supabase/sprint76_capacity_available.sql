-- ═════════════════════════════════════════════════════════════════
-- Sprint 76 — Capacity-available trigger (v0.33.0)
--
-- Doel: wanneer ergens een plek vrijkomt (lid verlaat groep, admin
-- verhoogt capaciteit), registreer een event-rij in
-- `capacity_available_events`. Admins krijgen deze events te zien
-- op /tenant/intake/vrijgekomen-plekken met top-N wachtlijst-
-- kandidaten + link naar placement-assistent. Geen auto-offer;
-- admin handelt semi-automatisch af.
--
-- Houtrust-veilig: zonder waitlisted submissions blijft
-- candidate_count=0 en wordt geen event aangemaakt. Trigger is
-- exception-tolerant (raise warning) zodat hij nooit een delete-
-- of update-transactie rollbackt.
--
-- Idempotent: create … if not exists / drop+create voor triggers.
-- ═════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. capacity_available_events
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.capacity_available_events (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  group_id        uuid not null,
  trigger_source  text not null,
  freed_seats     int  not null default 1,
  candidate_count int  not null default 0,
  status          text not null default 'open',
  handled_at      timestamptz,
  handled_by      uuid,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'capacity_available_events_group_tenant_fk') then
    alter table public.capacity_available_events
      add constraint capacity_available_events_group_tenant_fk
      foreign key (group_id, tenant_id)
      references public.groups (id, tenant_id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'capacity_available_events_source_check') then
    alter table public.capacity_available_events
      add constraint capacity_available_events_source_check
      check (trigger_source in ('member_removed','capacity_increased','manual'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'capacity_available_events_status_check') then
    alter table public.capacity_available_events
      add constraint capacity_available_events_status_check
      check (status in ('open','handled','dismissed','expired'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'capacity_available_events_freed_check') then
    alter table public.capacity_available_events
      add constraint capacity_available_events_freed_check
      check (freed_seats >= 1);
  end if;
end $$;

create index if not exists capacity_available_events_tenant_open_idx
  on public.capacity_available_events (tenant_id, created_at desc)
  where status = 'open';

create index if not exists capacity_available_events_group_idx
  on public.capacity_available_events (tenant_id, group_id, created_at desc);

-- Dedup-key: maximaal één open event per (tenant, group, day).
create unique index if not exists capacity_available_events_daily_uq
  on public.capacity_available_events
     (tenant_id, group_id, ((created_at at time zone 'UTC')::date))
  where status = 'open';

alter table public.capacity_available_events enable row level security;

drop policy if exists "capacity_available_events_tenant_all" on public.capacity_available_events;
create policy "capacity_available_events_tenant_all"
  on public.capacity_available_events
  for all
  using (has_tenant_access(tenant_id))
  with check (has_tenant_access(tenant_id));

comment on table public.capacity_available_events is
  'Sprint 76: event-log voor vrijgekomen plekken in groepen. '
  'Bron: trigger op group_members DELETE + groups UPDATE (capaciteit↑). '
  'Admin handelt af via /tenant/intake/vrijgekomen-plekken.';

-- ─────────────────────────────────────────────────────────────────
-- 2. record_capacity_available_event — interne helper
--
-- Counted wachtlijst-kandidaten = `intake_submissions` met
--   status='waitlisted' EN (s.program_id is null OR s.program_id
--   matcht groups.program_id). Bij geen kandidaten wordt
--   alsnog een rij geïnsert met candidate_count=0 — zodat admins
--   kunnen zien dat er een plek vrij was zonder kandidaten.
--   Day-dedup voorkomt spam bij meerdere mutaties op dezelfde dag.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.record_capacity_available_event(
  p_group_id uuid,
  p_source   text,
  p_freed    int default 1
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant         uuid;
  v_group_program  uuid;
  v_candidate_count int := 0;
  v_event_id       uuid;
begin
  select g.tenant_id, g.program_id
    into v_tenant, v_group_program
  from public.groups g
  where g.id = p_group_id;

  if v_tenant is null then
    return null;
  end if;

  -- Tel wachtlijst-kandidaten (best-effort, faalt nooit het event-insert).
  begin
    select count(*)::int into v_candidate_count
    from public.intake_submissions s
    where s.tenant_id = v_tenant
      and s.status = 'waitlisted'
      and (
        v_group_program is null
        or s.program_id is null
        or s.program_id = v_group_program
      );
  exception when others then
    v_candidate_count := 0;
  end;

  -- Insert event-rij; day-dedup partial unique index voorkomt duplicates.
  begin
    insert into public.capacity_available_events
      (tenant_id, group_id, trigger_source, freed_seats, candidate_count, meta)
    values
      (v_tenant, p_group_id, p_source, greatest(p_freed, 1), v_candidate_count,
       jsonb_build_object('program_id', v_group_program))
    returning id into v_event_id;
  exception when unique_violation then
    -- Bestaand open event vandaag — geef de bestaande id terug.
    select id into v_event_id
      from public.capacity_available_events
     where tenant_id = v_tenant
       and group_id  = p_group_id
       and status    = 'open'
       and (created_at at time zone 'UTC')::date
           = (now() at time zone 'UTC')::date
     order by created_at desc
     limit 1;
  end;

  return v_event_id;
end $$;

revoke all on function public.record_capacity_available_event(uuid, text, int) from public;
-- Trigger-functions roepen 'm aan als security definer; geen direct grant nodig.

-- ─────────────────────────────────────────────────────────────────
-- 3. Trigger op group_members AFTER DELETE
-- ─────────────────────────────────────────────────────────────────
create or replace function public._trg_capacity_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.record_capacity_available_event(old.group_id, 'member_removed', 1);
  exception when others then
    raise warning 'capacity_available: member_removed trigger failed: %', sqlerrm;
  end;
  return old;
end $$;

drop trigger if exists capacity_available_member_removed_t on public.group_members;
create trigger capacity_available_member_removed_t
  after delete on public.group_members
  for each row
  execute function public._trg_capacity_member_removed();

-- ─────────────────────────────────────────────────────────────────
-- 4. Trigger op groups AFTER UPDATE (max_athletes of max_members↑)
-- ─────────────────────────────────────────────────────────────────
create or replace function public._trg_capacity_groups_increased()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_diff_a int := coalesce(new.max_athletes, 0) - coalesce(old.max_athletes, 0);
  v_diff_m int := coalesce(new.max_members,  0) - coalesce(old.max_members,  0);
  v_diff   int;
begin
  v_diff := greatest(v_diff_a, v_diff_m);
  if v_diff > 0 then
    begin
      perform public.record_capacity_available_event(new.id, 'capacity_increased', v_diff);
    exception when others then
      raise warning 'capacity_available: groups_increased trigger failed: %', sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists capacity_available_groups_increased_t on public.groups;
create trigger capacity_available_groups_increased_t
  after update of max_athletes, max_members on public.groups
  for each row
  when (
    coalesce(new.max_athletes, 0) > coalesce(old.max_athletes, 0)
    or coalesce(new.max_members, 0) > coalesce(old.max_members, 0)
  )
  execute function public._trg_capacity_groups_increased();

-- ─────────────────────────────────────────────────────────────────
-- 5. RPC find_waitlist_candidates_for(group_id, limit)
--
-- Returnt FIFO-geordende wachtlijst-submissions die match'en met
-- de program-scope van de group. Tenant-authz binnen body
-- (Sprint-66/70-pattern).
-- ─────────────────────────────────────────────────────────────────
drop function if exists public.find_waitlist_candidates_for(uuid, int);

create or replace function public.find_waitlist_candidates_for(
  p_group_id uuid,
  p_limit    int default 10
) returns table(
  submission_id   uuid,
  contact_name    text,
  contact_email   text,
  program_id      uuid,
  program_name    text,
  created_at      timestamptz,
  status          text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant        uuid;
  v_group_program uuid;
begin
  select g.tenant_id, g.program_id
    into v_tenant, v_group_program
  from public.groups g
  where g.id = p_group_id;

  if v_tenant is null then
    return;
  end if;

  if not public.has_tenant_access(v_tenant) then
    raise exception 'access denied for group %', p_group_id
      using errcode = '42501';
  end if;

  return query
    select
      s.id,
      s.contact_name,
      s.contact_email,
      s.program_id,
      p.name,
      s.created_at,
      s.status
    from public.intake_submissions s
    left join public.programs p
           on p.id = s.program_id and p.tenant_id = v_tenant
    where s.tenant_id = v_tenant
      and s.status = 'waitlisted'
      and (
        v_group_program is null
        or s.program_id is null
        or s.program_id = v_group_program
      )
    order by s.created_at asc
    limit greatest(p_limit, 1);
end $$;

revoke all on function public.find_waitlist_candidates_for(uuid, int) from public;
grant execute on function public.find_waitlist_candidates_for(uuid, int) to authenticated;

comment on function public.find_waitlist_candidates_for(uuid, int) is
  'Sprint 76: FIFO wachtlijst-kandidaten voor een groep, beperkt tot '
  'submissions die match''en met de program-scope. Tenant-authz binnen body.';

-- Einde sprint76_capacity_available.sql
