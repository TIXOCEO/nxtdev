-- ──────────────────────────────────────────────────────────
-- Sprint 35 — Auto-reminder + per-member idempotency
--
--   1. Add training_attendance.reminder_sent_at (per-member marker).
--   2. Add training_sessions.reminder_run_at (per-session dedupe).
--
-- RLS not changed (columns inherit existing policies).
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

alter table public.training_attendance
  add column if not exists reminder_sent_at timestamptz;

alter table public.training_sessions
  add column if not exists reminder_run_at timestamptz;

create index if not exists training_sessions_reminder_window_idx
  on public.training_sessions (starts_at)
  where status = 'scheduled' and reminder_run_at is null;
