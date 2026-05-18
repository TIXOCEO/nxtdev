-- Sprint 82 — Slimme intake met 3 tijdsblok-voorstellen (v0.40.0).
--
-- Voegt fundament toe voor de publieke "kies-zelf-een-tijdsblok"-flow:
--   1) review_token + expiry op intake_submissions (single-use, 7d).
--   2) Helper-view program_group_waitlist_estimate (per group × stage).
--   3) Backfill default-expires op slot-offers blijft applicatief (72h).
--   4) Feature-flag tenants.settings_json.public_intake_propose_slots
--      hoeft geen SQL — jsonb is per-key opt-in en default afwezig
--      betekent flag=false.
--
-- Idempotent: drop+create voor de view, add column if not exists voor
-- nieuwe kolommen + unique index. Conform Sprint 41/43 dedup-pattern
-- worden geen nieuwe notif-keys toegevoegd — `intake_slot_offered`
-- bestaat al sinds Sprint 74.

begin;

-- (1) review_token op intake_submissions ----------------------------
-- Plain-text token (32-byte hex = 64 char) wordt in een mail-link
-- gezet en server-side per request gehasht voor lookup; we slaan de
-- sha256-hex hier op zodat een DB-dump het token niet leesbaar maakt.
alter table public.intake_submissions
  add column if not exists review_token_hash text;
alter table public.intake_submissions
  add column if not exists review_token_expires_at timestamptz;

create unique index if not exists intake_submissions_review_token_hash_uq
  on public.intake_submissions (review_token_hash)
  where review_token_hash is not null;

create index if not exists intake_submissions_review_token_expiry_idx
  on public.intake_submissions (review_token_expires_at)
  where review_token_hash is not null;

-- (2) Wachttijd-schatting view -------------------------------------
-- Per (group_id, stage_id) een ruwe inschatting: huidige wachtlijst
-- gedeeld door de aangenomen doorlooptijd (1 plek per 4 weken =
-- conservatieve baseline tot we ≥6 maanden attendance-historie
-- hebben). open_slots>0 → 0 weken. Cap 0–52.
drop view if exists public.program_group_waitlist_estimate;
create view public.program_group_waitlist_estimate
  with (security_invoker = true) as
select
  g.tenant_id,
  g.id                                              as group_id,
  gs.stage_id                                       as stage_id,
  coalesce(g.max_members, 0)                        as group_capacity,
  (
    select count(*)::int from public.group_members gm
    where gm.group_id = g.id
  )                                                 as group_member_count,
  greatest(
    0,
    coalesce(g.max_members, 0) - (
      select count(*)::int from public.group_members gm
      where gm.group_id = g.id
    )
  )                                                 as open_slots,
  (
    select count(*)::int from public.intake_submissions s
    where s.tenant_id = g.tenant_id
      and s.status = 'waitlisted'
      and s.recommended_stage_id = gs.stage_id
  )                                                 as current_waitlist_count,
  case
    when greatest(
      0,
      coalesce(g.max_members, 0) - (
        select count(*)::int from public.group_members gm
        where gm.group_id = g.id
      )
    ) > 0 then 0
    else least(
      52,
      (
        select count(*)::int from public.intake_submissions s
        where s.tenant_id = g.tenant_id
          and s.status = 'waitlisted'
          and s.recommended_stage_id = gs.stage_id
      ) * 4
    )
  end                                               as estimated_wait_weeks
from public.groups g
join public.group_stages gs
  on gs.group_id = g.id
 and gs.tenant_id = g.tenant_id;

grant select on public.program_group_waitlist_estimate to authenticated;
grant select on public.program_group_waitlist_estimate to anon;

commit;
