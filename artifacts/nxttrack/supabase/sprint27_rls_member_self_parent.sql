-- ──────────────────────────────────────────────────────────
-- Sprint 27 — RLS uitbreiding: self/parent-edit voor members
--                              en parent-edit voor mfd
--
-- Achtergrond:
--   `actions/public/profile.ts` gebruikte voor alle writes de
--   service-role client en regelde autorisatie handmatig in TS
--   (`assertSelfOrTenantAdmin`). Dat omzeilt RLS volledig — één
--   bug in de TS-helper kan cross-tenant schrijven veroorzaken.
--
--   De bestaande RLS-policies dekken:
--     • members          → alleen tenant-admins (has_tenant_access)
--     • mfd              → self of admin met members.financial.manage
--   Maar NIET:
--     • members → self (member.user_id = auth.uid())
--     • members → parent (via member_links)
--     • members → role-permission `members.edit` (zonder admin-rol)
--     • mfd     → parent (via member_links)
--
-- Deze migratie voegt de ontbrekende paden toe zodat de actions
-- veilig naar `createClient()` (anon-key + sessie) kunnen migreren.
--
-- Idempotent.
-- ──────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════
-- 0. Integriteit: member_links.tenant_id moet overeenkomen met
--    BÉIDE leden (parent + child). Zonder deze garantie kan een
--    admin een cross-tenant link forgen waardoor een ouder uit
--    tenant A schrijfrechten krijgt op een kind in tenant B
--    (privilege-escalatie). De trigger sluit dat gat.
-- ═════════════════════════════════════════════════════════
create or replace function public.enforce_member_links_tenant_consistency()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  parent_tenant uuid;
  child_tenant  uuid;
begin
  select tenant_id into parent_tenant from public.members where id = new.parent_member_id;
  select tenant_id into child_tenant  from public.members where id = new.child_member_id;
  if parent_tenant is null then
    raise exception 'member_links: parent_member_id % not found', new.parent_member_id;
  end if;
  if child_tenant is null then
    raise exception 'member_links: child_member_id % not found', new.child_member_id;
  end if;
  if parent_tenant <> new.tenant_id or child_tenant <> new.tenant_id then
    raise exception
      'member_links: tenant_id % does not match parent (%) / child (%) tenants',
      new.tenant_id, parent_tenant, child_tenant;
  end if;
  return new;
end$$;

drop trigger if exists member_links_enforce_tenant on public.member_links;
create trigger member_links_enforce_tenant
  before insert or update on public.member_links
  for each row execute function public.enforce_member_links_tenant_consistency();

-- ═════════════════════════════════════════════════════════
-- 1. Helper: kan de huidige user dit lid namens zichzelf of als
--    ouder muteren binnen de OPGEGEVEN tenant?
--
--    Tenant_id is verplicht: anders zou een geforgde
--    cross-tenant member_link toegang kunnen geven tot een lid
--    in een andere tenant. Door beide kolommen te checken
--    (members.tenant_id én member_links.tenant_id) is dat pad
--    dicht — ook als toekomstige bugs sectie 0 omzeilen.
-- ═════════════════════════════════════════════════════════
create or replace function public.user_can_act_for_member(
  target_member_id uuid,
  target_tenant_id uuid
)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.members m
     where m.id        = target_member_id
       and m.tenant_id = target_tenant_id
       and m.user_id   = auth.uid()
  )
  or exists (
    select 1
      from public.member_links ml
      join public.members c
        on c.id        = ml.child_member_id
       and c.tenant_id = target_tenant_id
      join public.members p
        on p.id        = ml.parent_member_id
       and p.tenant_id = target_tenant_id
       and p.user_id   = auth.uid()
     where ml.tenant_id        = target_tenant_id
       and ml.child_member_id  = target_member_id
  );
$$;

-- Oude één-arg variant uit eerdere iteratie opruimen (indien aanwezig).
drop function if exists public.user_can_act_for_member(uuid);

grant execute on function public.user_can_act_for_member(uuid, uuid) to authenticated;

-- ═════════════════════════════════════════════════════════
-- 2. members — extra UPDATE policy voor self / parent /
--    permission-holder. Bestaande `members_tenant_all` blijft
--    intact voor admin SELECT/INSERT/DELETE.
--
--    Permissive policies worden door PostgreSQL met OR
--    gecombineerd, dus we breiden de toegestane set uit
--    zonder admin-toegang te beperken.
-- ═════════════════════════════════════════════════════════
drop policy if exists "members_self_parent_perm_update" on public.members;
create policy "members_self_parent_perm_update" on public.members
  for update
  using (
    public.user_can_act_for_member(id, tenant_id)
    or public.user_has_tenant_permission(tenant_id, 'members.edit')
  )
  with check (
    public.user_can_act_for_member(id, tenant_id)
    or public.user_has_tenant_permission(tenant_id, 'members.edit')
  );

-- SELECT-pad zodat `.update().select()` de geschreven row kan
-- teruggeven onder dezelfde voorwaarden.
drop policy if exists "members_self_parent_perm_select" on public.members;
create policy "members_self_parent_perm_select" on public.members
  for select
  using (
    public.user_can_act_for_member(id, tenant_id)
    or public.user_has_tenant_permission(tenant_id, 'members.edit')
  );

-- ═════════════════════════════════════════════════════════
-- 3. member_financial_details — parent-pad toevoegen.
--    De bestaande policies dekken self + admin met permissie;
--    we voegen `user_can_act_for_member` toe zodat een ouder
--    de financiële gegevens van een gekoppeld kind kan
--    beheren — net als de TS-gate dat altijd al toestond.
-- ═════════════════════════════════════════════════════════
drop policy if exists "mfd_self_or_admin_select" on public.member_financial_details;
create policy "mfd_self_or_admin_select" on public.member_financial_details
  for select using (
    public.user_has_tenant_permission(tenant_id, 'members.financial.view')
    or public.user_can_act_for_member(member_id, tenant_id)
  );

drop policy if exists "mfd_self_or_admin_modify" on public.member_financial_details;
create policy "mfd_self_or_admin_modify" on public.member_financial_details
  for all
  using (
    public.user_has_tenant_permission(tenant_id, 'members.financial.manage')
    or public.user_can_act_for_member(member_id, tenant_id)
  )
  with check (
    public.user_has_tenant_permission(tenant_id, 'members.financial.manage')
    or public.user_can_act_for_member(member_id, tenant_id)
  );

-- ═════════════════════════════════════════════════════════
-- 4. payment_methods — read-pad voor authenticated users met
--    een lidmaatschap in dezelfde tenant. Nodig zodat de
--    profile-actions onder de user-sessie kunnen verifiëren
--    dat een gekozen betaalmethode bij de eigen tenant hoort
--    (en niet meer via service-role hoeven te lezen voor die
--    enkele check). De DB-trigger
--    `enforce_mfd_tenant_consistency` blijft de
--    autoritatieve poort.
-- ═════════════════════════════════════════════════════════
drop policy if exists "payment_methods_tenant_read" on public.payment_methods;
create policy "payment_methods_tenant_read" on public.payment_methods
  for select using (
    exists (
      select 1
        from public.members m
       where m.tenant_id = payment_methods.tenant_id
         and m.user_id  = auth.uid()
    )
    or public.has_tenant_access(payment_methods.tenant_id)
  );

-- ═════════════════════════════════════════════════════════
-- 5. RPC public.add_child_as_parent
--    Vervangt de service-role inserts in addChildAsParent.
--    SECURITY DEFINER + interne auth.uid()-checks zorgen dat:
--      • parent_member_id moet horen bij auth.uid() OR caller
--        is tenant/platform-admin van diezelfde tenant.
--      • parent_member zit gegarandeerd in p_tenant_id.
--      • Idempotent: als er al een child met identieke
--        first/last/birth onder deze parent hangt, geven we dat
--        kind terug i.p.v. een duplicate.
--      • Tenant-consistency van member_links wordt door de
--        trigger uit sectie 0 afgedwongen.
-- ═════════════════════════════════════════════════════════
drop function if exists public.add_child_as_parent(uuid, uuid, text, text, date, text, text);
create function public.add_child_as_parent(
  p_tenant_id        uuid,
  p_parent_member_id uuid,
  p_first_name       text,
  p_last_name        text,
  p_birth_date       date,
  p_gender           text,
  p_player_type      text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid          uuid := auth.uid();
  v_parent       record;
  v_existing_id  uuid;
  v_new_child_id uuid;
begin
  if v_uid is null then
    raise exception 'add_child_as_parent: not authenticated' using errcode = '42501';
  end if;
  if p_first_name is null or p_first_name = ''
     or p_last_name is null or p_last_name = '' then
    raise exception 'add_child_as_parent: first/last name required' using errcode = '22023';
  end if;

  select id, user_id, tenant_id
    into v_parent
    from public.members
   where id = p_parent_member_id
     and tenant_id = p_tenant_id;
  if v_parent.id is null then
    raise exception 'add_child_as_parent: parent member not found in tenant'
      using errcode = '42501';
  end if;
  if v_parent.user_id is distinct from v_uid then
    -- alleen platform/tenant-admins van DEZE tenant mogen voor een
    -- ander parent-account een kind aanmaken.
    if not (public.is_platform_admin() or public.is_tenant_admin(p_tenant_id)) then
      raise exception 'add_child_as_parent: only own children'
        using errcode = '42501';
    end if;
  end if;

  -- Idempotency: bestaand gekoppeld kind met identieke naam/geboortedatum?
  select c.id
    into v_existing_id
    from public.member_links ml
    join public.members c
      on c.id = ml.child_member_id
     and c.tenant_id = p_tenant_id
   where ml.tenant_id = p_tenant_id
     and ml.parent_member_id = p_parent_member_id
     and lower(coalesce(c.first_name, '')) = lower(p_first_name)
     and lower(coalesce(c.last_name,  '')) = lower(p_last_name)
     and (c.birth_date is not distinct from p_birth_date)
   limit 1;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into public.members
    (tenant_id, full_name, first_name, last_name, birth_date,
     gender, player_type, account_type, member_status)
    values
    (p_tenant_id,
     trim(p_first_name || ' ' || p_last_name),
     p_first_name, p_last_name, p_birth_date,
     nullif(p_gender, ''), nullif(p_player_type, ''),
     'minor_athlete', 'aspirant')
    returning id into v_new_child_id;

  insert into public.member_roles (member_id, role)
    values (v_new_child_id, 'athlete')
    on conflict do nothing;

  -- De tenant-consistency trigger verifieert nogmaals dat
  -- parent + child + link allen in p_tenant_id zitten.
  insert into public.member_links (tenant_id, parent_member_id, child_member_id)
    values (p_tenant_id, p_parent_member_id, v_new_child_id)
    on conflict do nothing;

  return v_new_child_id;
end$$;

grant execute on function public.add_child_as_parent(
  uuid, uuid, text, text, date, text, text
) to authenticated;
