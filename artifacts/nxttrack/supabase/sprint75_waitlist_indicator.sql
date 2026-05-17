-- ═════════════════════════════════════════════════════════════════
-- Sprint 75 — Publieke wachtrij-indicator (v0.32.0).
--
-- Voegt drie kolommen toe aan `programs` (thresholds + handmatig
-- label) en bouwt twee read-only views die wachtenden afzetten
-- tegen openstaande capaciteit voor de komende 12 weken:
--
--   public.program_waitlist_indicator           (per programma)
--   public.program_waitlist_indicator_by_stage  (per stage)
--
-- Beide views zijn `security_invoker=true` zodat RLS van de
-- onderliggende tabellen blijft gelden. Capacity wordt afgeleid
-- uit de bestaande `program_capacity_overview`-view (Sprint 62).
--
-- Houtrust-veilig:
--   * Alle nieuwe kolommen zijn nullable; default-heuristiek
--     leeft in app-code (`bucketWaitlistPressure`).
--   * Tenants zonder waitlisted-submissions / waitlist_entries
--     krijgen `waiting_count=0` → bucket 'short'.
--
-- Idempotent: `add column if not exists`, `drop view + create`,
-- `drop constraint if exists` voor checks.
-- ═════════════════════════════════════════════════════════════════

-- ── (1) programs — thresholds + handmatig label ───────────────
alter table public.programs
  add column if not exists waitlist_threshold_low  int,
  add column if not exists waitlist_threshold_high int,
  add column if not exists expected_wait_label     text;

alter table public.programs
  drop constraint if exists programs_waitlist_thresholds_chk;
alter table public.programs
  add constraint programs_waitlist_thresholds_chk
  check (
    (waitlist_threshold_low  is null or waitlist_threshold_low  >= 0)
    and (waitlist_threshold_high is null or waitlist_threshold_high >= 0)
    and (
      waitlist_threshold_low is null
      or waitlist_threshold_high is null
      or waitlist_threshold_high >= waitlist_threshold_low
    )
  );

alter table public.programs
  drop constraint if exists programs_expected_wait_label_len_chk;
alter table public.programs
  add constraint programs_expected_wait_label_len_chk
  check (expected_wait_label is null or char_length(expected_wait_label) <= 60);

comment on column public.programs.waitlist_threshold_low is
  'Sprint 75: ondergrens (waiting_count) voor "medium"-bucket; '
  'null = gebruik app-default (5).';
comment on column public.programs.waitlist_threshold_high is
  'Sprint 75: ondergrens (waiting_count) voor "long"-bucket; '
  'null = gebruik app-default (15).';
comment on column public.programs.expected_wait_label is
  'Sprint 75: optionele vrije tekst (max 60 char) zoals "± 6 weken" '
  'die naast de wachtrij-badge wordt getoond op de marketplace.';

-- ── (2) program_waitlist_indicator (per programma) ────────────
--
-- Capacity-tak (komende 12 weken / 84 dagen):
--   som over alle toekomstige, niet-afgelaste sessies van
--   max(fixed + flex - used, 0). De som zelf wordt nogmaals
--   geclampt naar ≥ 0 (defensief).
--
-- Waiting-tak: COALESCE-som van twee bronnen:
--   * intake_submissions.status = 'waitlisted'         (Sprint 73/74)
--   * waitlist_entries.status   = 'waiting'            (Sprint 49/64)
-- Beide moeten een program_id hebben — zonder kunnen we niet
-- aggregeren per programma.
-- ─────────────────────────────────────────────────────────────
drop view if exists public.program_waitlist_indicator cascade;

create view public.program_waitlist_indicator
with (security_invoker = true) as
with cap as (
  select
    pco.tenant_id,
    pco.program_id,
    coalesce(
      greatest(
        sum(
          greatest(
            coalesce(pco.fixed_capacity, 0)
            + coalesce(pco.flex_capacity, 0)
            - coalesce(pco.used_count, 0),
            0
          )
        )::int,
        0
      ),
      0
    ) as available_seats
  from public.program_capacity_overview pco
  where pco.program_id is not null
    and pco.starts_at > now()
    and pco.starts_at < now() + interval '84 days'
  group by pco.tenant_id, pco.program_id
),
waiting_subs as (
  select tenant_id, program_id, count(*)::int as cnt
  from public.intake_submissions
  where status = 'waitlisted' and program_id is not null
  group by tenant_id, program_id
),
waiting_entries as (
  select tenant_id, program_id, count(*)::int as cnt
  from public.waitlist_entries
  where status = 'waiting' and program_id is not null
  group by tenant_id, program_id
)
select
  p.tenant_id,
  p.id                                          as program_id,
  coalesce(ws.cnt, 0) + coalesce(we.cnt, 0)     as waiting_count,
  coalesce(c.available_seats, 0)                as available_seats
from public.programs p
left join cap             c  on c.tenant_id  = p.tenant_id and c.program_id  = p.id
left join waiting_subs    ws on ws.tenant_id = p.tenant_id and ws.program_id = p.id
left join waiting_entries we on we.tenant_id = p.tenant_id and we.program_id = p.id;

comment on view public.program_waitlist_indicator is
  'Sprint 75: per-programma waiting_count + available_seats over de '
  'komende 12 weken. Bucket-classificatie gebeurt in de app-laag '
  '(lib/programs/bucket-waitlist.ts).';

grant select on public.program_waitlist_indicator to authenticated, anon;

-- ── (3) program_waitlist_indicator_by_stage ───────────────────
--
-- Capacity per stage = som over de groepen die via `group_stages`
-- aan deze stage gekoppeld zijn (Sprint 72). Waiting per stage =
-- aantal `intake_submissions.status='waitlisted'` waarvan
-- coalesce(selected_stage_id, recommended_stage_id) deze stage is.
-- `waitlist_entries` heeft geen stage-veld en wordt hier niet
-- meegeteld — de programma-totaal-view dekt die wel.
-- ─────────────────────────────────────────────────────────────
drop view if exists public.program_waitlist_indicator_by_stage cascade;

create view public.program_waitlist_indicator_by_stage
with (security_invoker = true) as
with cap as (
  select
    pco.tenant_id,
    gs.stage_id,
    coalesce(
      greatest(
        sum(
          greatest(
            coalesce(pco.fixed_capacity, 0)
            + coalesce(pco.flex_capacity, 0)
            - coalesce(pco.used_count, 0),
            0
          )
        )::int,
        0
      ),
      0
    ) as available_seats
  from public.program_capacity_overview pco
  join public.group_stages gs
    on gs.tenant_id = pco.tenant_id
   and gs.group_id  = pco.group_id
  where pco.starts_at > now()
    and pco.starts_at < now() + interval '84 days'
  group by pco.tenant_id, gs.stage_id
),
waiting as (
  select
    tenant_id,
    coalesce(selected_stage_id, recommended_stage_id) as stage_id,
    count(*)::int as cnt
  from public.intake_submissions
  where status = 'waitlisted'
    and coalesce(selected_stage_id, recommended_stage_id) is not null
  group by tenant_id, coalesce(selected_stage_id, recommended_stage_id)
)
select
  s.tenant_id,
  s.program_id,
  s.id                              as stage_id,
  s.name                            as stage_name,
  s.color                           as stage_color,
  s.sort_order                      as stage_sort_order,
  coalesce(w.cnt, 0)                as waiting_count,
  coalesce(c.available_seats, 0)    as available_seats
from public.program_stages s
left join cap     c on c.tenant_id = s.tenant_id and c.stage_id = s.id
left join waiting w on w.tenant_id = s.tenant_id and w.stage_id = s.id
where s.archived_at is null;

comment on view public.program_waitlist_indicator_by_stage is
  'Sprint 75: per-stage waiting_count + available_seats. Capacity '
  'wordt gerouteerd via group_stages → groups → training_sessions.';

grant select on public.program_waitlist_indicator_by_stage to authenticated, anon;
