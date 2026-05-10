-- ──────────────────────────────────────────────────────────
-- Sprint 63 — Programs MVP fase 4: publieke marketplace
--
-- 1. Anon/authenticated SELECT-policy op `programs` voor publieke
--    rijen (visibility='public' AND public_slug IS NOT NULL),
--    naast de bestaande `programs_tenant_all` (tenant-admin write +
--    member read via has_tenant_access).
-- 2. `registrations.program_id` (nullable, composite-FK) zodat een
--    inschrijving via een program-deeplink terug-traceerbaar is.
-- 3. `members.intended_program_id` (nullable, composite-FK) +
--    uitbreiding van RPC `create_public_registration` met
--    `p_program_id`, zodat de actieve publieke wizard de
--    program-keuze opslaat op de primary member.
--
-- Houtrust-veilig: alle nieuwe kolommen NULL by default; RPC krijgt
-- nieuwe parameter met default null, maar omdat oude clients via
-- positionele argumenten aanroepen drop+recreate we de functie zodat
-- de nieuwe signature actief is.
--
-- Volledig idempotent.
-- ──────────────────────────────────────────────────────────

-- 1) Publieke read-policy op programs ─────────────────────────────
drop policy if exists programs_public_read on public.programs;
create policy programs_public_read
  on public.programs
  for select
  to anon, authenticated
  using (
    visibility = 'public'
    and public_slug is not null
  );

-- 2) registrations.program_id ─────────────────────────────────────
alter table public.registrations
  add column if not exists program_id uuid;

alter table public.registrations
  drop constraint if exists registrations_program_tenant_fk;
alter table public.registrations
  add constraint registrations_program_tenant_fk
  foreign key (program_id, tenant_id)
  references public.programs (id, tenant_id)
  on delete set null;

create index if not exists registrations_program_idx
  on public.registrations (tenant_id, program_id)
  where program_id is not null;

-- 3) members.intended_program_id ──────────────────────────────────
alter table public.members
  add column if not exists intended_program_id uuid;

alter table public.members
  drop constraint if exists members_intended_program_tenant_fk;
alter table public.members
  add constraint members_intended_program_tenant_fk
  foreign key (intended_program_id, tenant_id)
  references public.programs (id, tenant_id)
  on delete set null;

create index if not exists members_intended_program_idx
  on public.members (tenant_id, intended_program_id)
  where intended_program_id is not null;

-- 4) RPC `create_public_registration` — nieuwe `p_program_id` ─────
--    Drop eerst de oude signature; create or replace kan geen extra
--    parameter toevoegen.
drop function if exists public.create_public_registration(
  uuid, text, text, text, text, text, date, text, text, text, jsonb
);
drop function if exists public.create_public_registration(
  uuid, text, text, text, text, text, date, text, text, text, jsonb, uuid
);

create or replace function public.create_public_registration(
  p_tenant_id     uuid,
  p_account_type  text,
  p_first_name    text,
  p_last_name     text,
  p_email         text,
  p_phone         text,
  p_birth_date    date,
  p_player_type   text,
  p_status        text,
  p_role          text,
  p_children      jsonb,
  p_program_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name   text := nullif(trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), '');
  v_account_db  text := case p_account_type
                          when 'parent'        then 'parent'
                          when 'adult_athlete' then 'athlete'
                          when 'trainer'       then 'trainer'
                          when 'staff'         then 'staff'
                          else null
                        end;
  v_primary_id  uuid;
  v_child       jsonb;
  v_child_id    uuid;
  v_invite      record;
  v_link_code   text;
  v_child_full  text;
  v_program_ok  boolean;
begin
  if v_account_db is null then
    raise exception 'invalid_account_type:%', p_account_type;
  end if;

  -- Defense-in-depth: program moet bestaan binnen tenant + publiek zijn.
  -- App-laag valideert hetzelfde; deze check voorkomt cross-tenant-trickery
  -- via een rechtstreekse RPC-call.
  if p_program_id is not null then
    select true
      into v_program_ok
      from public.programs
     where id = p_program_id
       and tenant_id = p_tenant_id
       and visibility = 'public'
       and public_slug is not null
     limit 1;
    if not coalesce(v_program_ok, false) then
      raise exception 'invalid_program_id:%', p_program_id;
    end if;
  end if;

  -- 1. primary member
  insert into public.members (
    tenant_id, full_name, first_name, last_name, email, phone,
    account_type, member_status, birth_date, player_type,
    intended_program_id
  ) values (
    p_tenant_id, v_full_name, p_first_name, p_last_name,
    nullif(p_email, ''), nullif(p_phone, ''),
    v_account_db, p_status, p_birth_date, nullif(p_player_type, ''),
    p_program_id
  )
  returning id into v_primary_id;

  -- 2. role for primary
  insert into public.member_roles (member_id, role)
  values (v_primary_id, p_role)
  on conflict do nothing;

  -- 3. children (parent-flow only) — kinderen erven het program
  --    zodat een ouder die zich via een program-deeplink aanmeldt
  --    automatisch zijn kinderen op datzelfde program markeert.
  if p_account_type = 'parent' and jsonb_typeof(p_children) = 'array' then
    for v_child in
      select value from jsonb_array_elements(p_children)
    loop
      if (v_child->>'mode') = 'new' then
        v_child_full := nullif(
          trim(coalesce(v_child->>'first_name','') || ' ' || coalesce(v_child->>'last_name','')),
          ''
        );
        insert into public.members (
          tenant_id, full_name, first_name, last_name,
          account_type, member_status, birth_date, player_type,
          intended_program_id
        ) values (
          p_tenant_id, v_child_full,
          v_child->>'first_name',
          v_child->>'last_name',
          'minor_athlete', 'aspirant',
          (v_child->>'birth_date')::date,
          nullif(v_child->>'player_type', ''),
          p_program_id
        )
        returning id into v_child_id;

        insert into public.member_roles (member_id, role)
        values (v_child_id, 'athlete')
        on conflict do nothing;

        insert into public.member_links (tenant_id, parent_member_id, child_member_id)
        values (p_tenant_id, v_primary_id, v_child_id)
        on conflict do nothing;
      else
        v_link_code := upper(coalesce(v_child->>'koppel_code', ''));
        select id, child_member_id, status, expires_at
          into v_invite
          from public.member_invites
         where tenant_id  = p_tenant_id
           and invite_code = v_link_code
         limit 1;

        if not found
           or v_invite.child_member_id is null
           or v_invite.status in ('revoked', 'expired')
           or v_invite.expires_at < now()
        then
          raise exception 'invalid_koppel_code:%', v_link_code;
        end if;

        insert into public.member_links (tenant_id, parent_member_id, child_member_id)
        values (p_tenant_id, v_primary_id, v_invite.child_member_id)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return v_primary_id;
end;
$$;

revoke all on function public.create_public_registration(
  uuid, text, text, text, text, text, date, text, text, text, jsonb, uuid
) from public, anon, authenticated;

grant execute on function public.create_public_registration(
  uuid, text, text, text, text, text, date, text, text, text, jsonb, uuid
) to service_role;
