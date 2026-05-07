-- ──────────────────────────────────────────────────────────
-- Sprint 45 — Per-groep maximum aantal atleten.
--
-- Naast `groups.max_members` (totale capaciteit, telt iedereen mee)
-- introduceren we een aparte limiet die alleen leden met de rol
-- 'athlete' telt. Trainers / staff / overig blijven onbeperkt
-- toevoegbaar (mits totaal-cap niet overschreden wordt).
--
-- Idempotent / safe to re-run.
-- ──────────────────────────────────────────────────────────

alter table public.groups
  add column if not exists max_athletes int;

alter table public.groups
  drop constraint if exists groups_max_athletes_positive;
alter table public.groups
  add constraint groups_max_athletes_positive
  check (max_athletes is null or max_athletes > 0);

-- ──────────────────────────────────────────────────────────
-- Vervang enforce-trigger: check óók athlete-count wanneer
-- max_athletes is gezet. Zelfde advisory-lock pattern als
-- sprint 42 zodat concurrent inserts geserialiseerd worden
-- per groep.
-- ──────────────────────────────────────────────────────────
create or replace function public.enforce_group_max_members()
returns trigger
language plpgsql
as $$
declare
  v_max_members  int;
  v_max_athletes int;
  v_count        int;
  v_athlete_count int;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('group_members:' || new.group_id::text, 0)
  );

  select max_members, max_athletes
    into v_max_members, v_max_athletes
    from public.groups
   where id = new.group_id;

  if v_max_members is not null then
    select count(*) into v_count
      from public.group_members
     where group_id = new.group_id;
    if v_count > v_max_members then
      raise exception 'group_members_max_exceeded'
        using errcode = '23514',
              hint   = format('Groep is vol (%s plekken).', v_max_members);
    end if;
  end if;

  if v_max_athletes is not null then
    select count(*) into v_athlete_count
      from public.group_members gm
      join public.member_roles mr on mr.member_id = gm.member_id
     where gm.group_id = new.group_id
       and mr.role = 'athlete';
    if v_athlete_count > v_max_athletes then
      raise exception 'group_athletes_max_exceeded'
        using errcode = '23514',
              hint   = format('Maximum atleten bereikt (%s).', v_max_athletes);
    end if;
  end if;

  return new;
end;
$$;

-- Trigger zelf is in sprint 42 al aangemaakt en hangt aan dezelfde
-- function-naam — `create or replace function` hierboven is genoeg.
