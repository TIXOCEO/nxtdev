-- ──────────────────────────────────────────────────────────
-- Sprint 42 — Groups revamp (lijst + detail).
--
-- Adds:
--   * groups.max_members  int null  -- hard cap, null = unlimited
--   * groups.updated_at   timestamptz not null default now()
--     + trigger that keeps it fresh on updates.
--
-- group_members al unique (group_id, member_id) sinds sprint 8 — geen
-- extra index nodig, alleen documentatief gecontroleerd.
--
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

alter table public.groups
  add column if not exists max_members int;

alter table public.groups
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists groups_updated_at on public.groups;
create trigger groups_updated_at
  before update on public.groups
  for each row execute function public.handle_updated_at();

-- Defensieve sanity-check op `max_members`: 0 of negatief is nooit geldig.
-- Idempotent — drop eerst, daarna toevoegen.
alter table public.groups
  drop constraint if exists groups_max_members_positive;
alter table public.groups
  add constraint groups_max_members_positive
  check (max_members is null or max_members > 0);

-- ──────────────────────────────────────────────────────────
-- members.athlete_code — optionele, tenant-unieke code
--
-- De `members` tabel is canoniek voor personen in groepen, maar had
-- geen veld voor een athlete-/lid-code. Het bestaande `athletes`-table
-- is een ander concept (legacy: parent ↔ athlete-koppeling) en heeft
-- geen FK naar `members`. Voor de nieuwe groepenpagina (autocomplete-
-- zoek + CSV-import op athlete-code) hebben we de code dus direct op
-- de member nodig.
--
-- Nullable text. Uniek per tenant via een partial unique index zodat
-- meerdere tenants dezelfde code mogen gebruiken én lege rijen niet
-- conflicteren.
-- ──────────────────────────────────────────────────────────
alter table public.members
  add column if not exists athlete_code text;

drop index if exists members_athlete_code_tenant_uq;
create unique index members_athlete_code_tenant_uq
  on public.members (tenant_id, athlete_code)
  where athlete_code is not null;

create index if not exists members_athlete_code_search_idx
  on public.members (athlete_code)
  where athlete_code is not null;

-- ──────────────────────────────────────────────────────────
-- Hard enforcement van groups.max_members
--
-- De server-action doet al een pre-count, maar tussen pre-count en insert
-- kunnen twee parallelle requests beide door de check glippen en samen
-- de limiet overschrijden. Een trigger met `pg_advisory_xact_lock` per
-- groep serialiseert concurrent inserts op dezelfde groep en garandeert
-- dat het count-na-insert nooit boven `max_members` uitkomt.
--
-- We hashen group_id naar een bigint zodat hij in `pg_advisory_xact_lock`
-- past; transactie-scoped, dus auto-release bij commit/rollback.
-- ──────────────────────────────────────────────────────────
create or replace function public.enforce_group_max_members()
returns trigger
language plpgsql
as $$
declare
  v_max int;
  v_count int;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('group_members:' || new.group_id::text, 0)
  );

  select max_members into v_max
    from public.groups
   where id = new.group_id;

  if v_max is null then
    return new;
  end if;

  select count(*) into v_count
    from public.group_members
   where group_id = new.group_id;

  if v_count > v_max then
    raise exception 'group_members_max_exceeded'
      using errcode = '23514',
            hint   = format('Groep is vol (%s plekken).', v_max);
  end if;

  return new;
end;
$$;

drop trigger if exists group_members_enforce_max on public.group_members;
create constraint trigger group_members_enforce_max
  after insert on public.group_members
  deferrable initially deferred
  for each row execute function public.enforce_group_max_members();
