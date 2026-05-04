-- =============================================================
-- Sprint 19 — Social Feed System (Controlled Community Layer)
-- =============================================================
-- Idempotent. Re-runnable.

-- ---------- 1. social_settings ----------
create table if not exists public.social_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  allow_posts boolean not null default true,
  allow_comments boolean not null default true,
  allow_likes boolean not null default true,
  allow_media boolean not null default true,
  allow_auto_posts boolean not null default false,
  allow_mentions boolean not null default false,
  minor_read_only boolean not null default true,
  minor_team_feed_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 2. posts ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  author_member_id uuid references public.members(id) on delete set null,
  type text not null default 'user'
    check (type in ('user','system','achievement','coach_broadcast','training_recap','birthday')),
  content text,
  media_url text,
  media_type text check (media_type in ('image','video') or media_type is null),
  visibility text not null default 'tenant'
    check (visibility in ('tenant','team','trainers','private')),
  target_id uuid,
  comments_enabled boolean not null default true,
  is_pinned boolean not null default false,
  is_hidden boolean not null default false,
  coach_broadcast boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_tenant_created_idx on public.posts (tenant_id, created_at desc);
create index if not exists posts_tenant_visibility_idx on public.posts (tenant_id, visibility);
create index if not exists posts_tenant_target_idx on public.posts (tenant_id, target_id);
create index if not exists posts_author_idx on public.posts (author_member_id);

-- ---------- 3. post_likes ----------
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  emoji text not null default '👍',
  created_at timestamptz not null default now(),
  unique (post_id, member_id)
);
create index if not exists post_likes_post_idx on public.post_likes (post_id);

-- ---------- 4. comments ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_member_id uuid references public.members(id) on delete set null,
  content text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comments_post_created_idx on public.comments (post_id, created_at);
create index if not exists comments_parent_idx on public.comments (parent_id);

-- ---------- 5. social_mutes ----------
create table if not exists public.social_mutes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  muted_until timestamptz,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, member_id)
);
create index if not exists social_mutes_tm_idx on public.social_mutes (tenant_id, member_id);

-- ---------- 6. post_mentions ----------
create table if not exists public.post_mentions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  mentioned_member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists post_mentions_member_idx on public.post_mentions (tenant_id, mentioned_member_id);

-- ---------- 7. user_notification_preferences ----------
-- Already created in sprint14 (channel-based: email/push). Extend the
-- check constraint to also allow 'in_app' so users can mute in-app
-- notifications per category. Idempotent.
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema='public'
                and table_name='user_notification_preferences') then
    alter table public.user_notification_preferences
      drop constraint if exists user_notification_preferences_channel_check;
    alter table public.user_notification_preferences
      add constraint user_notification_preferences_channel_check
      check (channel in ('email','push','in_app'));
  end if;
end $$;

-- ============================================================
-- Helper: is current user tenant-admin / platform-admin?
-- (re-uses existing tenant_memberships pattern)
-- ============================================================
create or replace function public.fn_is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.tenant_memberships tm
     where tm.user_id = auth.uid()
       and (
         tm.role = 'platform_admin'
         or (tm.role = 'tenant_admin' and tm.tenant_id = p_tenant_id)
       )
  );
$$;

create or replace function public.fn_is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.members m
     where m.tenant_id = p_tenant_id
       and m.user_id = auth.uid()
  ) or public.fn_is_tenant_admin(p_tenant_id);
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.social_settings enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.social_mutes enable row level security;
alter table public.post_mentions enable row level security;

-- ---- social_settings ----
drop policy if exists ss_select on public.social_settings;
create policy ss_select on public.social_settings
  for select using (public.fn_is_tenant_member(tenant_id));

drop policy if exists ss_admin_all on public.social_settings;
create policy ss_admin_all on public.social_settings
  for all using (public.fn_is_tenant_admin(tenant_id))
  with check (public.fn_is_tenant_admin(tenant_id));

-- ---- posts ----
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select using (
    public.fn_is_tenant_member(tenant_id)
    and is_hidden = false
  );

drop policy if exists posts_admin_all on public.posts;
create policy posts_admin_all on public.posts
  for all using (public.fn_is_tenant_admin(tenant_id))
  with check (public.fn_is_tenant_admin(tenant_id));

-- ---- post_likes ----
drop policy if exists pl_select on public.post_likes;
create policy pl_select on public.post_likes
  for select using (public.fn_is_tenant_member(tenant_id));

drop policy if exists pl_admin_all on public.post_likes;
create policy pl_admin_all on public.post_likes
  for all using (public.fn_is_tenant_admin(tenant_id))
  with check (public.fn_is_tenant_admin(tenant_id));

-- ---- comments ----
drop policy if exists cm_select on public.comments;
create policy cm_select on public.comments
  for select using (
    public.fn_is_tenant_member(tenant_id)
    and is_hidden = false
  );

drop policy if exists cm_admin_all on public.comments;
create policy cm_admin_all on public.comments
  for all using (public.fn_is_tenant_admin(tenant_id))
  with check (public.fn_is_tenant_admin(tenant_id));

-- ---- social_mutes ----
drop policy if exists sm_select_self on public.social_mutes;
create policy sm_select_self on public.social_mutes
  for select using (
    public.fn_is_tenant_admin(tenant_id)
    or exists (
      select 1 from public.members m
       where m.id = social_mutes.member_id
         and m.user_id = auth.uid()
    )
  );

drop policy if exists sm_admin_all on public.social_mutes;
create policy sm_admin_all on public.social_mutes
  for all using (public.fn_is_tenant_admin(tenant_id))
  with check (public.fn_is_tenant_admin(tenant_id));

-- ---- post_mentions ----
drop policy if exists pm_select on public.post_mentions;
create policy pm_select on public.post_mentions
  for select using (
    public.fn_is_tenant_admin(tenant_id)
    or exists (
      select 1 from public.members m
       where m.id = post_mentions.mentioned_member_id
         and m.user_id = auth.uid()
    )
  );

drop policy if exists pm_admin_all on public.post_mentions;
create policy pm_admin_all on public.post_mentions
  for all using (public.fn_is_tenant_admin(tenant_id))
  with check (public.fn_is_tenant_admin(tenant_id));

-- ============================================================
-- Seed default social_settings + new module catalog entry
-- ============================================================
insert into public.social_settings (tenant_id)
  select id from public.tenants
  on conflict (tenant_id) do nothing;

insert into public.modules_catalog (key, name, description, config_schema, is_active)
values (
  'social_feed',
  'Social feed',
  'Toon recente community posts op de homepage.',
  '{}'::jsonb,
  true
)
on conflict (key) do nothing;
