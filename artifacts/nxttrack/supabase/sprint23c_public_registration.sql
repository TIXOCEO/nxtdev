-- ──────────────────────────────────────────────────────────
-- Sprint 23c — Public onboarding registration (atomic RPC)
--
-- Wraps de publieke wizard-write in één Postgres-transactie:
--   1. primary member (parent / athlete / trainer / staff)
--   2. member_role voor primary
--   3. (parent-only) per kind:
--        a) NEW   → insert member (minor_athlete) + role + link
--        b) LINK  → tenant-scoped lookup invite_code → link
--   Bij failure rollt alles automatisch terug.
--
-- Idempotent — veilig om meerdere keren te draaien.
-- Run AFTER sprint23_onboarding_foundation.sql.
-- ──────────────────────────────────────────────────────────

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
  p_children      jsonb
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
begin
  if v_account_db is null then
    raise exception 'invalid_account_type:%', p_account_type;
  end if;

  -- 1. primary member
  insert into public.members (
    tenant_id, full_name, first_name, last_name, email, phone,
    account_type, member_status, birth_date, player_type
  ) values (
    p_tenant_id, v_full_name, p_first_name, p_last_name,
    nullif(p_email, ''), nullif(p_phone, ''),
    v_account_db, p_status, p_birth_date, nullif(p_player_type, '')
  )
  returning id into v_primary_id;

  -- 2. role for primary
  insert into public.member_roles (member_id, role)
  values (v_primary_id, p_role)
  on conflict do nothing;

  -- 3. children (parent-flow only)
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
          account_type, member_status, birth_date, player_type
        ) values (
          p_tenant_id, v_child_full,
          v_child->>'first_name',
          v_child->>'last_name',
          'minor_athlete', 'aspirant',
          (v_child->>'birth_date')::date,
          nullif(v_child->>'player_type', '')
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
  uuid, text, text, text, text, text, date, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.create_public_registration(
  uuid, text, text, text, text, text, date, text, text, text, jsonb
) to service_role;
