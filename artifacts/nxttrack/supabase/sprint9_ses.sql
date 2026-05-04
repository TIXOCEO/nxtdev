-- ──────────────────────────────────────────────────────────
-- Sprint 9 (SES extension) — Amazon SES SMTP integration.
--
-- Changes:
--   1. tenants.email_domain_verified  bool  default false
--      Marks a tenant's custom `domain` as verified in SES so the
--      send pipeline may use `no-reply@<domain>`. Otherwise the
--      sender falls back to `no-reply@<slug>.nxttrack.nl`.
--
--   2. email_logs.provider   text     — which provider dispatched
--                                       the message ('amazon_ses').
--   3. email_logs.from_email text     — actual From: address used,
--                                       useful for diagnosing SES
--                                       reputation / DKIM issues.
--
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

alter table public.tenants
  add column if not exists email_domain_verified boolean not null default false;

alter table public.email_logs
  add column if not exists provider   text,
  add column if not exists from_email text;

create index if not exists email_logs_provider_idx
  on public.email_logs (provider, sent_at desc);
