-- Sprint 38 — Sector-aware participant subtype
--
-- Removes the football-biased CHECK constraint on `members.player_type`
-- (`('player','goalkeeper')`) so that non-football tenants (zwemschool,
-- atletiek, dans, …) can store their own subtype value (or simply leave
-- the column NULL). The column itself remains as a free-form text field;
-- a per-sector `participant_subtype` lookup table is intentionally left
-- to a follow-up sprint together with the platform-admin UI.
--
-- Idempotent: the constraint may already be dropped on environments that
-- ran an earlier patch.

alter table public.members
  drop constraint if exists members_player_type_chk;
