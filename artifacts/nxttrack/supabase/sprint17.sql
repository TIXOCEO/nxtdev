-- Sprint 17 — Social links · Messaging · (TipTap is client-only)
-- Run AFTER sprint16.sql.

-- ═════════════════════════════════════════════════════════
-- 1. Tenant social links
-- ═════════════════════════════════════════════════════════
create table if not exists public.tenant_social_links (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  platform    text not null,
  url         text not null default '',
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, platform)
);
create index if not exists tsl_tenant_idx on public.tenant_social_links (tenant_id);

drop trigger if exists tsl_updated_at on public.tenant_social_links;
create trigger tsl_updated_at
  before update on public.tenant_social_links
  for each row execute function public.handle_updated_at();

alter table public.tenant_social_links enable row level security;

drop policy if exists "tsl_admin_all"  on public.tenant_social_links;
create policy "tsl_admin_all" on public.tenant_social_links
  for all using (public.has_tenant_access(tenant_id))
          with check (public.has_tenant_access(tenant_id));

-- Public read for the active links (used in the public sidebar).
drop policy if exists "tsl_public_read" on public.tenant_social_links;
create policy "tsl_public_read" on public.tenant_social_links
  for select to anon, authenticated
  using (is_active = true and url <> '');

-- ═════════════════════════════════════════════════════════
-- 2. Messaging — conversations, participants, messages
-- ═════════════════════════════════════════════════════════
create table if not exists public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  title                 text not null,
  created_by_member_id  uuid not null references public.members(id) on delete cascade,
  created_at            timestamptz not null default now(),
  last_message_at       timestamptz not null default now()
);
create index if not exists conv_tenant_idx on public.conversations (tenant_id, last_message_at desc);

create table if not exists public.conversation_participants (
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  member_id        uuid not null references public.members(id) on delete cascade,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  last_read_at     timestamptz,
  added_at         timestamptz not null default now(),
  primary key (conversation_id, member_id)
);
create index if not exists cp_member_idx on public.conversation_participants (member_id);
create index if not exists cp_tenant_idx on public.conversation_participants (tenant_id);

create table if not exists public.messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations(id) on delete cascade,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  sender_member_id  uuid not null references public.members(id) on delete cascade,
  body              text not null,
  created_at        timestamptz not null default now()
);
create index if not exists msg_conv_idx on public.messages (conversation_id, created_at);

-- ── Helper: is the calling auth user a participant in a conversation? ──
create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.conversation_participants cp
      join public.members m on m.id = cp.member_id
      where cp.conversation_id = conv_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.conversations c
      where c.id = conv_id and public.is_tenant_admin(c.tenant_id)
    );
$$;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- conversations: tenant admin OR participant
drop policy if exists "conv_select" on public.conversations;
create policy "conv_select" on public.conversations
  for select using (
    public.has_tenant_access(tenant_id)
    or public.is_conversation_participant(id)
  );
drop policy if exists "conv_insert" on public.conversations;
create policy "conv_insert" on public.conversations
  for insert with check (
    public.has_tenant_access(tenant_id)
    or exists (
      select 1 from public.members m
      where m.id = created_by_member_id
        and m.tenant_id = conversations.tenant_id
        and m.user_id = auth.uid()
    )
  );
drop policy if exists "conv_update" on public.conversations;
create policy "conv_update" on public.conversations
  for update using (
    public.has_tenant_access(tenant_id)
    or public.is_conversation_participant(id)
  ) with check (true);
drop policy if exists "conv_delete" on public.conversations;
create policy "conv_delete" on public.conversations
  for delete using (public.has_tenant_access(tenant_id));

-- participants
drop policy if exists "cp_select" on public.conversation_participants;
create policy "cp_select" on public.conversation_participants
  for select using (
    public.has_tenant_access(tenant_id)
    or public.is_conversation_participant(conversation_id)
  );
drop policy if exists "cp_modify" on public.conversation_participants;
create policy "cp_modify" on public.conversation_participants
  for all using (
    public.has_tenant_access(tenant_id)
    or public.is_conversation_participant(conversation_id)
  ) with check (
    public.has_tenant_access(tenant_id)
    or public.is_conversation_participant(conversation_id)
  );

-- messages
drop policy if exists "msg_select" on public.messages;
create policy "msg_select" on public.messages
  for select using (
    public.has_tenant_access(tenant_id)
    or public.is_conversation_participant(conversation_id)
  );
drop policy if exists "msg_insert" on public.messages;
create policy "msg_insert" on public.messages
  for insert with check (
    public.has_tenant_access(tenant_id)
    or public.is_conversation_participant(conversation_id)
  );
drop policy if exists "msg_delete" on public.messages;
create policy "msg_delete" on public.messages
  for delete using (
    public.has_tenant_access(tenant_id)
    or exists (
      select 1 from public.members m
      where m.id = messages.sender_member_id
        and m.user_id = auth.uid()
    )
  );

-- Bump conversation last_message_at on each new message.
create or replace function public.bump_conversation_last_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
    set last_message_at = NEW.created_at
    where id = NEW.conversation_id;
  return NEW;
end;
$$;
drop trigger if exists msg_bump_last_at on public.messages;
create trigger msg_bump_last_at
  after insert on public.messages
  for each row execute function public.bump_conversation_last_message();
