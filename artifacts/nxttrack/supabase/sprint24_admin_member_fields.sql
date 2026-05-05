-- Sprint 24 / Sprint D — admin "Voeg toe"-wizard veldjes
-- Adds:
--   members.member_since (date)        — administratieve startdatum
--   members.notes        (text)        — interne notities (admin-only)
-- Idempotent: kan veilig opnieuw worden gedraaid.

alter table public.members
  add column if not exists member_since date,
  add column if not exists notes        text;

create index if not exists members_member_since_idx
  on public.members (tenant_id, member_since);
