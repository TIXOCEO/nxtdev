-- ──────────────────────────────────────────────────────────
-- Sprint 35 — Notitiemodel + RLS-trainerlees
--
--   1. New columns: training_attendance.note + note_visibility.
--   2. Backfill from existing notes / trainer_note.
--   3. Add RLS policies so trainers can read attendance for sessions of
--      groups they belong to (member_roles.role='trainer' OR
--      tenant_member_roles → tenant_roles.is_trainer_role).
--      Existing self_read policy continues to allow members; the UI/server
--      filter the `note` column when note_visibility='private'.
--   4. Add RLS write policy for trainers.
--
-- We keep the legacy `notes` and `trainer_note` columns for one release as
-- a rollback safety net. UI writes only `note` + `note_visibility`.
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

alter table public.training_attendance
  add column if not exists note text,
  add column if not exists note_visibility text not null default 'private'
    check (note_visibility in ('private','member'));

-- Backfill once: prefer trainer_note (private), then notes (member-visible).
update public.training_attendance
   set note = coalesce(nullif(trainer_note,''), nullif(notes,'')),
       note_visibility = case
         when nullif(trainer_note,'') is not null then 'private'
         when nullif(notes,'') is not null then 'member'
         else 'private'
       end
 where note is null
   and (nullif(trainer_note,'') is not null or nullif(notes,'') is not null);

-- ─── RLS — trainer read/write across own group ────────────
-- A trainer is anyone with member_roles.role='trainer' for a member that
-- shares a group_members row with the attendance row's member, AND that
-- member is owned by auth.uid(). We allow this regardless of legacy
-- has_tenant_access(); the existing tenant-admin policies remain.

drop policy if exists "training_attendance_trainer_read"  on public.training_attendance;
drop policy if exists "training_attendance_trainer_write" on public.training_attendance;

create policy "training_attendance_trainer_read"
  on public.training_attendance
  for select
  using (
    exists (
      select 1
        from public.training_sessions s
        join public.group_members gm_t on gm_t.group_id = s.group_id
        join public.members        mt  on mt.id = gm_t.member_id
        join public.member_roles   mr  on mr.member_id = mt.id and mr.role = 'trainer'
       where s.id = training_attendance.session_id
         and mt.tenant_id = training_attendance.tenant_id
         and mt.user_id = auth.uid()
    )
    or exists (
      select 1
        from public.training_sessions s
        join public.group_members gm_t      on gm_t.group_id = s.group_id
        join public.members        mt       on mt.id = gm_t.member_id
        join public.tenant_member_roles tmr on tmr.member_id = mt.id and tmr.tenant_id = mt.tenant_id
        join public.tenant_roles  tr        on tr.id = tmr.role_id and tr.is_trainer_role
       where s.id = training_attendance.session_id
         and mt.tenant_id = training_attendance.tenant_id
         and mt.user_id = auth.uid()
    )
  );

create policy "training_attendance_trainer_write"
  on public.training_attendance
  for update
  using (
    exists (
      select 1
        from public.training_sessions s
        join public.group_members gm_t on gm_t.group_id = s.group_id
        join public.members        mt  on mt.id = gm_t.member_id
        join public.member_roles   mr  on mr.member_id = mt.id and mr.role = 'trainer'
       where s.id = training_attendance.session_id
         and mt.tenant_id = training_attendance.tenant_id
         and mt.user_id = auth.uid()
    )
    or exists (
      select 1
        from public.training_sessions s
        join public.group_members gm_t      on gm_t.group_id = s.group_id
        join public.members        mt       on mt.id = gm_t.member_id
        join public.tenant_member_roles tmr on tmr.member_id = mt.id and tmr.tenant_id = mt.tenant_id
        join public.tenant_roles  tr        on tr.id = tmr.role_id and tr.is_trainer_role
       where s.id = training_attendance.session_id
         and mt.tenant_id = training_attendance.tenant_id
         and mt.user_id = auth.uid()
    )
  )
  with check (true);
