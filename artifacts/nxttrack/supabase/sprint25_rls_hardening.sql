-- ──────────────────────────────────────────────────────────
-- Sprint 25 — RLS hardening (Sprint G cleanup)
--
-- Belt-and-braces: revoke alle direct grants aan anon/public
-- voor de gevoelige Sprint 23/24 tabellen. RLS staat al aan
-- (zie sprint23_onboarding_foundation.sql), maar door grants
-- expliciet te beperken voorkomen we per ongeluk een lek
-- via PostgREST views of nieuwe rollen.
--
-- Idempotent — veilig om opnieuw te draaien.
-- ──────────────────────────────────────────────────────────

revoke all on public.member_financial_details from anon;
revoke all on public.member_financial_details from public;

revoke all on public.payment_methods from anon;
-- payment_methods.name + IBAN_for_rekening worden door de publieke
-- profielpagina gelezen via een SECURITY-DEFINER call (admin client),
-- dus anon hoeft hier geen direct grant te hebben. Service-role
-- bypasst RLS sowieso.
revoke all on public.payment_methods from public;

-- members + member_links horen ook nooit direct door anon gelezen te
-- worden. Bestaande RLS-policies regelen authenticated-toegang; deze
-- revoke voorkomt een per-ongeluk grant aan PUBLIC.
revoke all on public.member_links from anon;
revoke all on public.member_invites from anon;

-- Restore minimal grants nodig voor RLS-pass-through onder
-- authenticated. (RLS bepaalt de uiteindelijke zichtbaarheid.)
grant select, insert, update, delete on public.member_financial_details to authenticated;
grant select, insert, update, delete on public.payment_methods           to authenticated;
grant select, insert, update, delete on public.member_links              to authenticated;
grant select, insert, update, delete on public.member_invites            to authenticated;
