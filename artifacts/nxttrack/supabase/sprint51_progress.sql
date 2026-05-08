-- ──────────────────────────────────────────────────────────
-- Sprint 51 — Voortgangsfundament (positieve scoring) + extra wensen
--
--   * Boomstructuur module → categorie → onderdeel.
--   * Optionele description (zichtbaarheid private/member) en video_url
--     op alle drie de niveaus + extra `video_url` op item-niveau.
--   * scoring_labels per tenant met DB-enforced positief karakter
--     (`is_positive_outcome=true`) + optionele `emoji` en `star_value`.
--   * Append-only progress_scores (latest per item via view).
--   * Tenant-instelling `tenants.settings_json -> progress_render_style`
--     ('text' default | 'stars' | 'emoji').
--
-- RLS-pattern volgt member_observations: tenant-admin all, trainer in
-- gedeelde groep read+write, lid (member_visibility='member') lees-only.
--
-- Volledig idempotent.
-- ──────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════
-- 1. Modules / categorieën / onderdelen
-- ═════════════════════════════════════════════════════════════════
create table if not exists public.progress_modules (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  slug         text        not null,
  name         text        not null,
  description  text,
  description_visibility text not null default 'private'
              check (description_visibility in ('private','member')),
  is_active    boolean     not null default true,
  sort_order   int         not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists progress_modules_tenant_idx
  on public.progress_modules (tenant_id, sort_order);

drop trigger if exists progress_modules_updated_at on public.progress_modules;
create trigger progress_modules_updated_at
  before update on public.progress_modules
  for each row execute function public.handle_updated_at();

create table if not exists public.progress_categories (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  module_id    uuid        not null references public.progress_modules(id) on delete cascade,
  slug         text        not null,
  name         text        not null,
  description  text,
  description_visibility text not null default 'private'
              check (description_visibility in ('private','member')),
  sort_order   int         not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (module_id, slug)
);

create index if not exists progress_categories_module_idx
  on public.progress_categories (module_id, sort_order);

drop trigger if exists progress_categories_updated_at on public.progress_categories;
create trigger progress_categories_updated_at
  before update on public.progress_categories
  for each row execute function public.handle_updated_at();

create table if not exists public.progress_items (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  category_id  uuid        not null references public.progress_categories(id) on delete cascade,
  slug         text        not null,
  name         text        not null,
  description  text,
  description_visibility text not null default 'private'
              check (description_visibility in ('private','member')),
  video_url    text,
  sort_order   int         not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (category_id, slug)
);

create index if not exists progress_items_category_idx
  on public.progress_items (category_id, sort_order);

drop trigger if exists progress_items_updated_at on public.progress_items;
create trigger progress_items_updated_at
  before update on public.progress_items
  for each row execute function public.handle_updated_at();

-- ═════════════════════════════════════════════════════════════════
-- 2. Scoring-labels (per tenant) — positief-only DB-enforced
-- ═════════════════════════════════════════════════════════════════
create table if not exists public.scoring_labels (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  slug         text        not null,
  name         text        not null,
  color        text,
  emoji        text,
  star_value   smallint    check (star_value is null or (star_value between 1 and 5)),
  is_positive_outcome boolean not null default true
              check (is_positive_outcome = true),
  sort_order   int         not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists scoring_labels_tenant_idx
  on public.scoring_labels (tenant_id, sort_order);

drop trigger if exists scoring_labels_updated_at on public.scoring_labels;
create trigger scoring_labels_updated_at
  before update on public.scoring_labels
  for each row execute function public.handle_updated_at();

-- ═════════════════════════════════════════════════════════════════
-- 3. Append-only scores
-- ═════════════════════════════════════════════════════════════════
create table if not exists public.progress_scores (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants(id) on delete cascade,
  member_id       uuid        not null references public.members(id) on delete cascade,
  item_id         uuid        not null references public.progress_items(id) on delete cascade,
  label_id        uuid        not null references public.scoring_labels(id) on delete restrict,
  session_id      uuid        references public.training_sessions(id) on delete set null,
  recorded_by     uuid        references auth.users(id) on delete set null,
  visibility      text        not null default 'private'
                  check (visibility in ('private','member')),
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists progress_scores_member_item_idx
  on public.progress_scores (tenant_id, member_id, item_id, created_at desc);
create index if not exists progress_scores_session_idx
  on public.progress_scores (session_id);

-- ═════════════════════════════════════════════════════════════════
-- 4. View: laatste score per (member, item)
-- ═════════════════════════════════════════════════════════════════
create or replace view public.progress_member_latest as
  select distinct on (s.tenant_id, s.member_id, s.item_id)
         s.tenant_id,
         s.member_id,
         s.item_id,
         s.label_id,
         s.visibility,
         s.created_at as recorded_at
    from public.progress_scores s
   order by s.tenant_id, s.member_id, s.item_id, s.created_at desc;

-- ═════════════════════════════════════════════════════════════════
-- 5. RLS — tenant-admin all + trainer-in-shared-group + member-read
-- ═════════════════════════════════════════════════════════════════
alter table public.progress_modules    enable row level security;
alter table public.progress_categories enable row level security;
alter table public.progress_items      enable row level security;
alter table public.scoring_labels      enable row level security;
alter table public.progress_scores     enable row level security;

-- Definitie-tabellen — tenant-admin all + lezen door iedereen met
-- tenant-membership (zodat trainer/lid de boom kan zien).
do $$
declare t text;
begin
  foreach t in array array['progress_modules','progress_categories','progress_items','scoring_labels'] loop
    execute format('drop policy if exists "%s_tenant_all" on public.%s', t, t);
    execute format('create policy "%s_tenant_all" on public.%s for all using (public.has_tenant_access(tenant_id)) with check (public.has_tenant_access(tenant_id))', t, t);
    execute format('drop policy if exists "%s_member_read" on public.%s', t, t);
    execute format($f$create policy "%s_member_read" on public.%s for select using (exists (select 1 from public.members m where m.tenant_id = %s.tenant_id and m.user_id = auth.uid()))$f$, t, t, t);
  end loop;
end $$;

-- Scores — tenant-admin all + trainer-in-shared-group rw + lid/ouder read (visibility=member)
drop policy if exists "progress_scores_tenant_all"     on public.progress_scores;
drop policy if exists "progress_scores_trainer_select" on public.progress_scores;
drop policy if exists "progress_scores_trainer_insert" on public.progress_scores;
drop policy if exists "progress_scores_self_read"      on public.progress_scores;

create policy "progress_scores_tenant_all" on public.progress_scores
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

create policy "progress_scores_trainer_select" on public.progress_scores
  for select
  using (
    exists (
      select 1
        from public.group_members gm_a
        join public.group_members gm_t on gm_t.group_id = gm_a.group_id
        join public.members        mt  on mt.id = gm_t.member_id
        join public.member_roles   mr  on mr.member_id = mt.id and mr.role = 'trainer'
       where gm_a.member_id = progress_scores.member_id
         and mt.tenant_id   = progress_scores.tenant_id
         and mt.user_id     = auth.uid()
    )
  );

create policy "progress_scores_trainer_insert" on public.progress_scores
  for insert
  with check (
    recorded_by = auth.uid()
    and exists (
      select 1
        from public.group_members gm_a
        join public.group_members gm_t on gm_t.group_id = gm_a.group_id
        join public.members        mt  on mt.id = gm_t.member_id
        join public.member_roles   mr  on mr.member_id = mt.id and mr.role = 'trainer'
       where gm_a.member_id = progress_scores.member_id
         and mt.tenant_id   = progress_scores.tenant_id
         and mt.user_id     = auth.uid()
    )
  );

create policy "progress_scores_self_read" on public.progress_scores
  for select
  using (
    visibility = 'member'
    and (
      exists (
        select 1 from public.members m
         where m.id = progress_scores.member_id
           and m.tenant_id = progress_scores.tenant_id
           and m.user_id = auth.uid()
      )
      or exists (
        select 1 from public.member_links ml
          join public.members p on p.id = ml.parent_member_id
         where ml.child_member_id = progress_scores.member_id
           and p.tenant_id = progress_scores.tenant_id
           and p.user_id = auth.uid()
      )
    )
  );

-- ═════════════════════════════════════════════════════════════════
-- 6. Backfill: progress_render_style = 'text' op iedere tenant
-- ═════════════════════════════════════════════════════════════════
update public.tenants
   set settings_json = coalesce(settings_json, '{}'::jsonb)
       || jsonb_build_object('progress_render_style', 'text')
 where coalesce(settings_json -> 'progress_render_style', 'null'::jsonb) = 'null'::jsonb;
