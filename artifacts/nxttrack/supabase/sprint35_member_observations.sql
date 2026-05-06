-- ──────────────────────────────────────────────────────────
-- Sprint 35 — Minimaal leerlingvolgsysteem (LVS)
--
--   1. Table member_observations (tenant-scoped).
--   2. RLS:
--      - select: tenant-admin (has_tenant_access) OR trainer in shared
--        group OR (visibility='member' AND auth.uid() = member.user_id
--        of self/parent).
--      - insert/update/delete: tenant-admin OR trainer in shared group
--        and only their own author_user_id.
--
-- Safe to re-run.
-- ──────────────────────────────────────────────────────────

create table if not exists public.member_observations (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants(id) on delete cascade,
  member_id       uuid        not null references public.members(id) on delete cascade,
  author_user_id  uuid        not null references auth.users(id) on delete restrict,
  session_id      uuid        references public.training_sessions(id) on delete set null,
  body            text        not null,
  visibility      text        not null default 'private'
                  check (visibility in ('private','member')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists member_observations_member_idx
  on public.member_observations (tenant_id, member_id, created_at desc);
create index if not exists member_observations_session_idx
  on public.member_observations (session_id);

drop trigger if exists member_observations_updated_at on public.member_observations;
create trigger member_observations_updated_at
  before update on public.member_observations
  for each row execute function public.handle_updated_at();

alter table public.member_observations enable row level security;

drop policy if exists "obs_tenant_all"        on public.member_observations;
drop policy if exists "obs_trainer_select"    on public.member_observations;
drop policy if exists "obs_trainer_insert"    on public.member_observations;
drop policy if exists "obs_trainer_update"    on public.member_observations;
drop policy if exists "obs_trainer_delete"    on public.member_observations;
drop policy if exists "obs_self_select"       on public.member_observations;

-- Tenant admins: full access.
create policy "obs_tenant_all" on public.member_observations
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Trainers in a shared group: read + write.
create policy "obs_trainer_select" on public.member_observations
  for select
  using (
    exists (
      select 1
        from public.group_members gm_a
        join public.group_members gm_t on gm_t.group_id = gm_a.group_id
        join public.members        mt  on mt.id = gm_t.member_id
        join public.member_roles   mr  on mr.member_id = mt.id and mr.role = 'trainer'
       where gm_a.member_id = member_observations.member_id
         and mt.tenant_id   = member_observations.tenant_id
         and mt.user_id     = auth.uid()
    )
    or exists (
      select 1
        from public.group_members gm_a
        join public.group_members gm_t      on gm_t.group_id = gm_a.group_id
        join public.members        mt       on mt.id = gm_t.member_id
        join public.tenant_member_roles tmr on tmr.member_id = mt.id and tmr.tenant_id = mt.tenant_id
        join public.tenant_roles   tr       on tr.id = tmr.role_id and tr.is_trainer_role
       where gm_a.member_id = member_observations.member_id
         and mt.tenant_id   = member_observations.tenant_id
         and mt.user_id     = auth.uid()
    )
  );

create policy "obs_trainer_insert" on public.member_observations
  for insert
  with check (
    author_user_id = auth.uid()
    and (
      exists (
        select 1
          from public.group_members gm_a
          join public.group_members gm_t on gm_t.group_id = gm_a.group_id
          join public.members        mt  on mt.id = gm_t.member_id
          join public.member_roles   mr  on mr.member_id = mt.id and mr.role = 'trainer'
         where gm_a.member_id = member_observations.member_id
           and mt.tenant_id   = member_observations.tenant_id
           and mt.user_id     = auth.uid()
      )
      or exists (
        select 1
          from public.group_members gm_a
          join public.group_members gm_t      on gm_t.group_id = gm_a.group_id
          join public.members        mt       on mt.id = gm_t.member_id
          join public.tenant_member_roles tmr on tmr.member_id = mt.id and tmr.tenant_id = mt.tenant_id
          join public.tenant_roles   tr       on tr.id = tmr.role_id and tr.is_trainer_role
         where gm_a.member_id = member_observations.member_id
           and mt.tenant_id   = member_observations.tenant_id
           and mt.user_id     = auth.uid()
      )
    )
  );

-- Update/delete: own author row AND still trainer in a shared group.
create policy "obs_trainer_update" on public.member_observations
  for update
  using (
    author_user_id = auth.uid()
    and (
      exists (
        select 1
          from public.group_members gm_a
          join public.group_members gm_t on gm_t.group_id = gm_a.group_id
          join public.members        mt  on mt.id = gm_t.member_id
          join public.member_roles   mr  on mr.member_id = mt.id and mr.role = 'trainer'
         where gm_a.member_id = member_observations.member_id
           and mt.tenant_id   = member_observations.tenant_id
           and mt.user_id     = auth.uid()
      )
      or exists (
        select 1
          from public.group_members gm_a
          join public.group_members gm_t      on gm_t.group_id = gm_a.group_id
          join public.members        mt       on mt.id = gm_t.member_id
          join public.tenant_member_roles tmr on tmr.member_id = mt.id and tmr.tenant_id = mt.tenant_id
          join public.tenant_roles   tr       on tr.id = tmr.role_id and tr.is_trainer_role
         where gm_a.member_id = member_observations.member_id
           and mt.tenant_id   = member_observations.tenant_id
           and mt.user_id     = auth.uid()
      )
    )
  )
  with check (
    author_user_id = auth.uid()
    and (
      exists (
        select 1
          from public.group_members gm_a
          join public.group_members gm_t on gm_t.group_id = gm_a.group_id
          join public.members        mt  on mt.id = gm_t.member_id
          join public.member_roles   mr  on mr.member_id = mt.id and mr.role = 'trainer'
         where gm_a.member_id = member_observations.member_id
           and mt.tenant_id   = member_observations.tenant_id
           and mt.user_id     = auth.uid()
      )
      or exists (
        select 1
          from public.group_members gm_a
          join public.group_members gm_t      on gm_t.group_id = gm_a.group_id
          join public.members        mt       on mt.id = gm_t.member_id
          join public.tenant_member_roles tmr on tmr.member_id = mt.id and tmr.tenant_id = mt.tenant_id
          join public.tenant_roles   tr       on tr.id = tmr.role_id and tr.is_trainer_role
         where gm_a.member_id = member_observations.member_id
           and mt.tenant_id   = member_observations.tenant_id
           and mt.user_id     = auth.uid()
      )
    )
  );

create policy "obs_trainer_delete" on public.member_observations
  for delete
  using (
    author_user_id = auth.uid()
    and (
      exists (
        select 1
          from public.group_members gm_a
          join public.group_members gm_t on gm_t.group_id = gm_a.group_id
          join public.members        mt  on mt.id = gm_t.member_id
          join public.member_roles   mr  on mr.member_id = mt.id and mr.role = 'trainer'
         where gm_a.member_id = member_observations.member_id
           and mt.tenant_id   = member_observations.tenant_id
           and mt.user_id     = auth.uid()
      )
      or exists (
        select 1
          from public.group_members gm_a
          join public.group_members gm_t      on gm_t.group_id = gm_a.group_id
          join public.members        mt       on mt.id = gm_t.member_id
          join public.tenant_member_roles tmr on tmr.member_id = mt.id and tmr.tenant_id = mt.tenant_id
          join public.tenant_roles   tr       on tr.id = tmr.role_id and tr.is_trainer_role
         where gm_a.member_id = member_observations.member_id
           and mt.tenant_id   = member_observations.tenant_id
           and mt.user_id     = auth.uid()
      )
    )
  );

-- Self / parent: read member-visible observations only.
create policy "obs_self_select" on public.member_observations
  for select
  using (
    visibility = 'member'
    and (
      exists (
        select 1 from public.members m
         where m.id = member_observations.member_id
           and m.user_id = auth.uid()
      )
      or exists (
        select 1
          from public.member_links ml
          join public.members p on p.id = ml.parent_member_id
         where ml.child_member_id = member_observations.member_id
           and ml.tenant_id = member_observations.tenant_id
           and p.user_id = auth.uid()
      )
    )
  );
