-- Sprint 30 — Race-vrije homepage-layout mutaties.
-- Doel:
--   • addTenantModule en updateModuleLayout serialiseren per tenant via een
--     transactionele advisory lock, zodat twee gelijktijdige admin-acties
--     nooit hetzelfde slot kunnen claimen of overlappende layouts kunnen
--     committen.
--   • De slot-berekening voor een nieuwe module gebeurt nu volledig in de
--     database (binnen de lock), niet meer in de Node-laag.
-- Run AFTER sprint29_homepage_modules_v2.sql. Idempotent.

-- ───────────────────────────────────────────────────────────────
-- 1. add_tenant_module — atomair: lock → vrije plek zoeken → insert
-- ───────────────────────────────────────────────────────────────
create or replace function public.add_tenant_module(
  p_tenant_id      uuid,
  p_module_key     text,
  p_title          text,
  p_size           text,
  p_w              int,
  p_h              int,
  p_visible_for    text,
  p_visible_mobile boolean,
  p_config         jsonb
) returns public.tenant_modules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key      bigint;
  v_max_y         int;
  v_y             int;
  v_x             int;
  v_found         boolean := false;
  v_next_position int;
  v_row           public.tenant_modules;
begin
  -- Eén lock-namespace per tenant. hashtextextended geeft een 64-bit waarde
  -- en is stable; pg_advisory_xact_lock laat de lock automatisch los aan
  -- het einde van de transactie.
  v_lock_key := hashtextextended('tenant_modules_layout:' || p_tenant_id::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  select coalesce(max(position_y + h), 0)
    into v_max_y
    from public.tenant_modules
   where tenant_id = p_tenant_id;

  -- Scan rij-per-rij voor het eerste vrije slot dat past binnen 2 kolommen.
  for v_y in 0..v_max_y loop
    v_x := 0;
    while v_x + p_w <= 2 loop
      if not exists (
        select 1
          from public.tenant_modules
         where tenant_id = p_tenant_id
           and position_x < v_x + p_w
           and position_x + w > v_x
           and position_y < v_y + p_h
           and position_y + h > v_y
      ) then
        v_found := true;
        exit;
      end if;
      v_x := v_x + 1;
    end loop;
    exit when v_found;
  end loop;

  if not v_found then
    v_x := 0;
    v_y := v_max_y;
  end if;

  select coalesce(max(position), -1) + 1
    into v_next_position
    from public.tenant_modules
   where tenant_id = p_tenant_id;

  insert into public.tenant_modules
    (tenant_id, module_key, title, size, position,
     position_x, position_y, w, h,
     visible_for, visible_mobile, config)
  values
    (p_tenant_id, p_module_key, p_title, p_size, v_next_position,
     v_x, v_y, p_w, p_h,
     p_visible_for, p_visible_mobile, p_config)
  returning * into v_row;

  return v_row;
end;
$$;

-- Alleen de service-role mag deze RPC aanroepen. Authorisatie (wie mag
-- bij welke tenant) gebeurt in de Node-laag via assertTenantAccess
-- voordat de admin-client (service role) de RPC roept. Een directe call
-- vanaf een ingelogde end-user mag dus niet kunnen.
revoke all on function public.add_tenant_module(
  uuid, text, text, text, int, int, text, boolean, jsonb
) from public;
revoke all on function public.add_tenant_module(
  uuid, text, text, text, int, int, text, boolean, jsonb
) from authenticated, anon;
grant execute on function public.add_tenant_module(
  uuid, text, text, text, int, int, text, boolean, jsonb
) to service_role;

-- ───────────────────────────────────────────────────────────────
-- 2. update_tenant_module_layout — atomaire layout-rewrite per tenant
-- ───────────────────────────────────────────────────────────────
-- p_items :: jsonb-array van {id, x, y, w, h, size}. De caller heeft de
-- payload al gevalideerd (volledige set, geen overlap, bounds). Deze
-- functie zorgt enkel dat alle updates in één transactie en achter de
-- per-tenant lock gebeuren, zodat twee gelijktijdige writers elkaar niet
-- in de wielen rijden.
create or replace function public.update_tenant_module_layout(
  p_tenant_id uuid,
  p_items     jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key      bigint;
  v_item          jsonb;
  v_count         int;
  v_payload_ids   uuid[];
  v_current_ids   uuid[];
begin
  v_lock_key := hashtextextended('tenant_modules_layout:' || p_tenant_id::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a jsonb array';
  end if;

  -- Onder de lock: payload moet exact de huidige set tenant-modules
  -- dekken. Als er tussen pre-validatie en lock een module bijkwam of
  -- weggehaald werd, weigert de RPC zodat de admin opnieuw moet laden.
  select coalesce(array_agg(id order by id), '{}')
    into v_current_ids
    from public.tenant_modules
   where tenant_id = p_tenant_id;

  select coalesce(array_agg(distinct (e->>'id')::uuid order by (e->>'id')::uuid), '{}')
    into v_payload_ids
    from jsonb_array_elements(p_items) as e;

  if v_payload_ids <> v_current_ids then
    raise exception 'tenant_modules layout payload out of sync for tenant %', p_tenant_id
      using errcode = '40001';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    update public.tenant_modules
       set position_x = (v_item->>'x')::int,
           position_y = (v_item->>'y')::int,
           w          = (v_item->>'w')::int,
           h          = (v_item->>'h')::int,
           size       = v_item->>'size'
     where id        = (v_item->>'id')::uuid
       and tenant_id = p_tenant_id;
    get diagnostics v_count = row_count;
    if v_count = 0 then
      raise exception 'tenant_module % does not belong to tenant %',
        v_item->>'id', p_tenant_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.update_tenant_module_layout(uuid, jsonb)
  from public;
revoke all on function public.update_tenant_module_layout(uuid, jsonb)
  from authenticated, anon;
grant execute on function public.update_tenant_module_layout(uuid, jsonb)
  to service_role;
