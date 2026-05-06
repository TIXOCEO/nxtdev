-- ──────────────────────────────────────────────────────────
-- RLS-policy test voor Sprint 27.
--
-- Doel: bewijzen dat een willekeurige authenticated user geen
-- vreemd member of mfd-record kan updaten nu de profile-actions
-- via createClient() en dus via RLS lopen — inclusief het
-- exploit-pad waarbij een geforgde cross-tenant member_link
-- toegang zou kunnen geven tot een lid in een andere tenant.
--
-- Run handmatig:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f artifacts/nxttrack/supabase/tests/sprint27_rls_member_isolation.sql
--
-- Alle wijzigingen worden binnen één transactie gedaan en aan
-- het eind teruggerold; er blijft niets in de database staan.
-- ──────────────────────────────────────────────────────────

begin;

do $$
declare
  t_a uuid := gen_random_uuid();
  t_b uuid := gen_random_uuid();
  m_a uuid := gen_random_uuid();
  m_b uuid := gen_random_uuid();
  m_a_child uuid := gen_random_uuid();
  u_a uuid := gen_random_uuid();
  u_b uuid := gen_random_uuid();
  affected int;
  forged_caught boolean := false;
begin
  -- Setup als service_role (bypasst RLS).
  set local role postgres;

  insert into public.tenants (id, slug, name)
    values (t_a, 'test-tenant-a-' || substr(t_a::text,1,8), 'Tenant A');
  insert into public.tenants (id, slug, name)
    values (t_b, 'test-tenant-b-' || substr(t_b::text,1,8), 'Tenant B');

  insert into public.members
    (id, tenant_id, user_id, full_name, first_name, last_name, account_type, member_status)
    values
    (m_a,       t_a, u_a,  'A User',  'A', 'User',  'athlete',      'aspirant'),
    (m_a_child, t_a, null, 'A Child', 'A', 'Child', 'minor_athlete','aspirant'),
    (m_b,       t_b, u_b,  'B User',  'B', 'User',  'athlete',      'aspirant');

  -- ── Test 1: u_a probeert m_b (vreemde tenant) te updaten ──
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', u_a::text, true);

  update public.members
     set first_name = 'HACKED'
   where id = m_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception
      'FAIL: cross-tenant update succeeded (% rows). RLS is broken.',
      affected;
  end if;

  -- ── Test 2: u_a updatet eigen member (m_a) — moet slagen ──
  update public.members
     set first_name = 'Updated'
   where id = m_a;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception
      'FAIL: self-update affected % rows (verwacht 1). RLS te streng.',
      affected;
  end if;

  -- ── Test 3: u_a probeert mfd van m_b te upserten ──
  begin
    insert into public.member_financial_details
      (member_id, tenant_id, iban, account_holder_name)
      values (m_b, t_b, 'NL00BANK0123456789', 'Hacker');
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception
        'FAIL: cross-tenant mfd insert succeeded (% rows). RLS is broken.',
        affected;
    end if;
  exception
    when insufficient_privilege or check_violation then
      -- verwacht; RLS WITH CHECK gooide de row weg.
      null;
  end;

  -- ── Test 4: u_a kan eigen mfd upserten ──
  insert into public.member_financial_details
    (member_id, tenant_id, account_holder_name)
    values (m_a, t_a, 'A Self');
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception
      'FAIL: self mfd insert affected % rows (verwacht 1).', affected;
  end if;

  -- ── Test 5: parent-pad werkt binnen één tenant ──
  set local role postgres;
  insert into public.member_links (tenant_id, parent_member_id, child_member_id)
    values (t_a, m_a, m_a_child);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  update public.members
     set first_name = 'Updated by parent'
   where id = m_a_child;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception
      'FAIL: parent-update affected % rows (verwacht 1).', affected;
  end if;

  -- ── Test 6: GEFORGDE cross-tenant member_link wordt geweigerd
  --    door de tenant-consistency trigger. Zelfs een service-role
  --    insert die pretendeert dat parent (tenant A) en child
  --    (tenant B) in tenant A zitten, moet falen.
  set local role postgres;
  begin
    insert into public.member_links (tenant_id, parent_member_id, child_member_id)
      values (t_a, m_a, m_b);
    -- Mocht de trigger ontbreken, zorg dan in elk geval dat de
    -- helper de exploit niet honoreert (zie test 7 hieronder).
  exception
    when others then
      forged_caught := true;
  end;
  if not forged_caught then
    raise exception
      'FAIL: forged cross-tenant member_link insert was NOT blocked by trigger.';
  end if;

  -- ── Test 7: Defense-in-depth: zelfs als een geforgde link in
  --    member_links zou belanden (we simuleren door de trigger
  --    tijdelijk uit te schakelen), mag user_can_act_for_member
  --    geen update toelaten op een member uit een andere tenant.
  alter table public.member_links disable trigger member_links_enforce_tenant;
  insert into public.member_links (tenant_id, parent_member_id, child_member_id)
    values (t_a, m_a, m_b);
  alter table public.member_links enable trigger member_links_enforce_tenant;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  update public.members
     set first_name = 'EXPLOITED'
   where id = m_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception
      'FAIL: forged-link cross-tenant update succeeded (% rows). Helper not tenant-aware.',
      affected;
  end if;

  -- ── Test 8: add_child_as_parent RPC weigert vreemd parent_member_id
  --    Caller u_a probeert een kind aan te maken onder m_b (tenant B).
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', u_a::text, true);
  begin
    perform public.add_child_as_parent(
      t_b, m_b, 'Forged', 'Child', null::date, ''::text, ''::text
    );
    raise exception
      'FAIL: add_child_as_parent permitted forging child under foreign parent.';
  exception
    when insufficient_privilege then null;  -- verwacht
  end;

  -- ── Test 9: add_child_as_parent happy-path (eigen tenant) ──
  declare
    new_child uuid;
  begin
    new_child := public.add_child_as_parent(
      t_a, m_a, 'Newly', 'Spawned', '2015-06-01'::date, ''::text, ''::text
    );
    if new_child is null then
      raise exception 'FAIL: add_child_as_parent returned null on happy path.';
    end if;
    -- idempotency: 2e call met identieke args geeft hetzelfde id terug
    if new_child <> public.add_child_as_parent(
        t_a, m_a, 'Newly', 'Spawned', '2015-06-01'::date, ''::text, ''::text)
    then
      raise exception 'FAIL: add_child_as_parent not idempotent.';
    end if;
  end;

  raise notice 'Sprint 27 RLS tests OK';
end $$;

rollback;
