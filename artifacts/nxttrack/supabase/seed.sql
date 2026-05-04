-- ─────────────────────────────────────────────────────────
-- NXTTRACK — Seed
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────

insert into public.tenants (name, slug, primary_color, status)
values ('Voetbalschool Houtrust', 'voetbalschool-houtrust', '#b6d83b', 'active')
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────
-- PLATFORM ADMIN
-- After logging in once with magic link, find your auth user id in
-- Supabase Dashboard → Authentication → Users, then run:
--
--   insert into public.tenant_memberships (tenant_id, user_id, role)
--   values (null, 'YOUR_USER_ID_HERE', 'platform_admin');
--
-- (tenant_id MUST be null for platform_admin — enforced by check
-- constraint tenant_memberships_role_tenant_check.)
-- ─────────────────────────────────────────────────────────
