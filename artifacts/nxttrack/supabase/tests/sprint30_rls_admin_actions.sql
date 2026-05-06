-- ──────────────────────────────────────────────────────────
-- RLS-policy test voor Sprint 30.
--
-- Doel: bewijzen dat een willekeurige authenticated user in
-- tenant A geen rijen van tenant B kan muteren in de tabellen
-- die door sprint 30 vanaf de service-role naar het RLS-pad
-- gemigreerd zijn:
--
--   sponsors, alerts, media_wall_items, tenant_active_themes,
--   tenant_seo_settings, tenant_page_seo, tenant_social_links,
--   tenant_custom_pages
--
-- Tegelijk verifieert deze test dat een tenant-admin
-- (lid via tenant_memberships.role = 'tenant_admin') WEL kan
-- muteren binnen de eigen tenant — we mogen geen regressie
-- introduceren door per ongeluk te strenge policies.
--
-- Run handmatig:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f artifacts/nxttrack/supabase/tests/sprint30_rls_admin_actions.sql
--
-- Alle wijzigingen worden binnen één transactie gedaan en aan
-- het eind teruggerold; er blijft niets in de database staan.
-- ──────────────────────────────────────────────────────────

begin;

do $$
declare
  t_a uuid := gen_random_uuid();
  t_b uuid := gen_random_uuid();
  u_a uuid := gen_random_uuid();   -- gewone authenticated user in tenant A
  u_b_admin uuid := gen_random_uuid(); -- tenant-admin van tenant B
  m_a uuid := gen_random_uuid();
  v_theme_id uuid := gen_random_uuid();
  affected int;

  -- B-side rijen die u_a NIET mag aanraken
  sponsor_b uuid := gen_random_uuid();
  alert_b   uuid := gen_random_uuid();
  mwall_b   uuid := gen_random_uuid();
  page_b    uuid := gen_random_uuid();
  pageseo_b uuid := gen_random_uuid();
  custom_b  uuid := gen_random_uuid();
begin
  -- ── Setup als service_role (bypasst RLS) ────────────────
  set local role postgres;

  insert into public.tenants (id, slug, name)
    values (t_a, 'rls30-a-' || substr(t_a::text,1,8), 'Tenant A');
  insert into public.tenants (id, slug, name)
    values (t_b, 'rls30-b-' || substr(t_b::text,1,8), 'Tenant B');

  -- u_a: gewoon lid (geen admin) van tenant A
  insert into public.members (id, tenant_id, user_id, full_name,
                              first_name, last_name, account_type, member_status)
    values (m_a, t_a, u_a, 'A User', 'A', 'User', 'athlete', 'aspirant');

  -- u_b_admin: tenant_admin van tenant B
  insert into public.tenant_memberships (user_id, tenant_id, role)
    values (u_b_admin, t_b, 'tenant_admin');

  -- B-side seedrijen.
  insert into public.sponsors (id, tenant_id, name)
    values (sponsor_b, t_b, 'B Sponsor');
  insert into public.alerts (id, tenant_id, title, type, is_active)
    values (alert_b, t_b, 'B Alert', 'announcement', true);
  insert into public.media_wall_items (id, tenant_id, media_url, media_type)
    values (mwall_b, t_b, 'https://example.com/x.jpg', 'image');
  insert into public.themes (id, scope, tenant_id, name, mode, tokens, is_default)
    values (v_theme_id, 'platform', null, 'Sprint30 Theme', 'light', '{}'::jsonb, false);
  insert into public.tenant_active_themes (tenant_id, theme_id, enabled)
    values (t_b, v_theme_id, true);
  insert into public.tenant_seo_settings (tenant_id, default_title)
    values (t_b, 'B title');
  insert into public.tenant_page_seo (id, tenant_id, page_path, title)
    values (pageseo_b, t_b, 'about', 'B about');
  insert into public.tenant_social_links (tenant_id, platform, url, is_active)
    values (t_b, 'instagram', 'https://insta/b', true);
  insert into public.tenant_custom_pages (id, tenant_id, parent_id, title, slug)
    values (custom_b, t_b, null, 'B page', 'about-b');

  -- ── Tests als u_a (niet-admin in A) tegen tenant B ─────
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', u_a::text, true);

  -- sponsors
  update public.sponsors set name = 'HACK' where id = sponsor_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: cross-tenant sponsors update (% rows)', affected;
  end if;
  delete from public.sponsors where id = sponsor_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: cross-tenant sponsors delete (% rows)', affected;
  end if;
  begin
    insert into public.sponsors (tenant_id, name) values (t_b, 'X');
    raise exception 'FAIL: cross-tenant sponsors insert succeeded';
  exception when insufficient_privilege or check_violation then
    null;
  end;

  -- alerts
  update public.alerts set title = 'HACK' where id = alert_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: cross-tenant alerts update (% rows)', affected;
  end if;

  -- media_wall_items
  update public.media_wall_items set media_url = 'HACK' where id = mwall_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: cross-tenant media_wall update (% rows)', affected;
  end if;

  -- tenant_active_themes
  update public.tenant_active_themes set enabled = false
    where tenant_id = t_b and theme_id = v_theme_id;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: cross-tenant active_themes update (% rows)', affected;
  end if;

  -- tenant_seo_settings
  update public.tenant_seo_settings set default_title = 'HACK' where tenant_id = t_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: cross-tenant seo_settings update (% rows)', affected;
  end if;

  -- tenant_page_seo
  update public.tenant_page_seo set title = 'HACK' where id = pageseo_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: cross-tenant page_seo update (% rows)', affected;
  end if;

  -- tenant_social_links
  update public.tenant_social_links set url = 'https://hack' where tenant_id = t_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: cross-tenant social_links update (% rows)', affected;
  end if;

  -- tenant_custom_pages
  update public.tenant_custom_pages set title = 'HACK' where id = custom_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: cross-tenant custom_pages update (% rows)', affected;
  end if;

  -- ── Tests als u_b_admin (admin van B) — moeten slagen ──
  perform set_config('request.jwt.claim.sub', u_b_admin::text, true);

  update public.sponsors set name = 'B Sponsor v2' where id = sponsor_b;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'FAIL: tenant-admin sponsor update affected % rows', affected;
  end if;

  update public.alerts set title = 'B Alert v2' where id = alert_b;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'FAIL: tenant-admin alert update affected % rows', affected;
  end if;

  update public.tenant_seo_settings set default_title = 'B v2' where tenant_id = t_b;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'FAIL: tenant-admin seo_settings update affected % rows', affected;
  end if;

  update public.tenant_custom_pages set title = 'B v2' where id = custom_b;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'FAIL: tenant-admin custom_pages update affected % rows', affected;
  end if;

  raise notice 'sprint30_rls_admin_actions: OK';
end$$;

rollback;
