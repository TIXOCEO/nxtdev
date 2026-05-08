-- ═════════════════════════════════════════════════════════════════
-- Sprint 55 — Zwemschool-fundament hardening
--
-- Adresseert de architectural-review bevindingen op sprint 47-54:
--   1. btree_gist exclusion-constraint op session_resources
--      (resource mag niet dubbel geboekt worden in dezelfde tijd).
--   2. milestone_event_invites krijgt expires_at + used_at zodat
--      decision-tokens een levensduur en one-time-use semantiek
--      hebben.
--   3. notification dedup-index/RPC krijgt source-key
--      `progress_milestone_reached` (Sprint 41/43-patroon: drop +
--      recreate index, predicate match in `on conflict ... where`).
--   4. Description-privacy DB-side enforced: revoke column-grant
--      voor authenticated/anon op progress_*.description, en lever
--      `progress_*_public`-views met security_invoker die
--      description nullen wanneer visibility='private'.
-- Idempotent — veilig om meermaals te draaien.
-- ═════════════════════════════════════════════════════════════════

create extension if not exists btree_gist;

-- ─────────────────────────────────────────────────────────────────
-- 1. session_resources — overlap-bescherming via gist exclusion.
--    De starts_at/ends_at leven op training_sessions, dus we
--    denormaliseren ze hier (gehouden in sync via twee triggers)
--    en plaatsen daar de exclusion-constraint op.
-- ─────────────────────────────────────────────────────────────────
alter table public.session_resources
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz;

update public.session_resources sr
   set starts_at = ts.starts_at,
       ends_at   = ts.ends_at
  from public.training_sessions ts
 where ts.id = sr.session_id
   and (sr.starts_at is null or sr.ends_at is null);

create or replace function public.session_resources_sync_range()
returns trigger
language plpgsql
as $$
begin
  if new.session_id is not null then
    select ts.starts_at, ts.ends_at
      into new.starts_at, new.ends_at
      from public.training_sessions ts
     where ts.id = new.session_id;
  end if;
  return new;
end;
$$;

drop trigger if exists session_resources_sync_range_t on public.session_resources;
create trigger session_resources_sync_range_t
  before insert or update of session_id on public.session_resources
  for each row execute function public.session_resources_sync_range();

create or replace function public.training_sessions_propagate_range()
returns trigger
language plpgsql
as $$
begin
  if (new.starts_at is distinct from old.starts_at)
     or (new.ends_at is distinct from old.ends_at) then
    update public.session_resources
       set starts_at = new.starts_at,
           ends_at   = new.ends_at
     where session_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists training_sessions_propagate_range_t on public.training_sessions;
create trigger training_sessions_propagate_range_t
  after update of starts_at, ends_at on public.training_sessions
  for each row execute function public.training_sessions_propagate_range();

-- Exclusion: zelfde resource mag niet overlappen in de tijd.
-- Predicate negeert rijen waarvoor de range nog niet ingevuld is
-- (defensive — sync-trigger vult ze normaliter direct in).
alter table public.session_resources
  drop constraint if exists session_resources_no_overlap;

alter table public.session_resources
  add constraint session_resources_no_overlap
  exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (starts_at is not null and ends_at is not null);

-- ─────────────────────────────────────────────────────────────────
-- 2. milestone_event_invites — decision-token TTL + one-time-use.
-- ─────────────────────────────────────────────────────────────────
alter table public.milestone_event_invites
  add column if not exists expires_at timestamptz,
  add column if not exists used_at    timestamptz;

-- Backfill: bestaande invites zonder expiry → 30 dagen na creatie.
update public.milestone_event_invites
   set expires_at = created_at + interval '30 days'
 where expires_at is null;

create index if not exists milestone_event_invites_token_active_idx
  on public.milestone_event_invites (decision_token)
  where used_at is null;

create index if not exists milestone_event_invites_expiry_idx
  on public.milestone_event_invites (expires_at)
  where used_at is null;

-- ─────────────────────────────────────────────────────────────────
-- 3. notification dedup — extend met progress_milestone_reached.
--    Sprint 41/43-patroon: index drop+recreate, RPC predicate
--    één-op-één synchroon met de nieuwe index.
-- ─────────────────────────────────────────────────────────────────
drop index if exists public.notifications_source_idem_uq;

create unique index notifications_source_idem_uq
  on public.notifications (tenant_id, source, source_ref)
  where source in (
          'training_created',
          'training_reminder',
          'group_assigned',
          'news_published',
          'membership_assigned',
          'invite_accepted',
          'attendance_changed_late',
          'trainer_attendance_updated',
          'waitlist_offer_sent',
          'waitlist_offer_accepted',
          'waitlist_offer_declined',
          'makeup_credit_granted',
          'makeup_request_approved',
          'makeup_request_declined',
          'milestone_event_invited',
          'milestone_event_result_published',
          'certificate_issued',
          'progress_milestone_reached'
        )
    and source_ref is not null;

create or replace function public.create_notification_with_recipients(
  p_tenant_id     uuid,
  p_title         text,
  p_content_html  text,
  p_content_text  text,
  p_source        text,
  p_source_ref    uuid,
  p_created_by    uuid,
  p_targets       jsonb,
  p_recipients    jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notif_id     uuid;
  is_dedupable boolean;
  recipient    jsonb;
begin
  is_dedupable :=
    p_source_ref is not null
    and coalesce(p_source, '') in (
      'training_created','training_reminder','group_assigned',
      'news_published','membership_assigned','invite_accepted',
      'attendance_changed_late','trainer_attendance_updated',
      'waitlist_offer_sent','waitlist_offer_accepted','waitlist_offer_declined',
      'makeup_credit_granted','makeup_request_approved','makeup_request_declined',
      'milestone_event_invited','milestone_event_result_published','certificate_issued',
      'progress_milestone_reached'
    );

  if is_dedupable then
    select id into notif_id
      from public.notifications
     where tenant_id = p_tenant_id
       and source    = p_source
       and source_ref = p_source_ref
     limit 1;
    if notif_id is not null then
      return notif_id;
    end if;
  end if;

  insert into public.notifications
    (tenant_id, title, content_html, content_text, source, source_ref, created_by)
  values
    (p_tenant_id, p_title, p_content_html, p_content_text, p_source, p_source_ref, p_created_by)
  on conflict (tenant_id, source, source_ref)
    where source in (
            'training_created','training_reminder','group_assigned',
            'news_published','membership_assigned','invite_accepted',
            'attendance_changed_late','trainer_attendance_updated',
            'waitlist_offer_sent','waitlist_offer_accepted','waitlist_offer_declined',
            'makeup_credit_granted','makeup_request_approved','makeup_request_declined',
            'milestone_event_invited','milestone_event_result_published','certificate_issued',
            'progress_milestone_reached'
          )
      and source_ref is not null
    do nothing
  returning id into notif_id;

  if notif_id is null and is_dedupable then
    select id into notif_id
      from public.notifications
     where tenant_id = p_tenant_id
       and source    = p_source
       and source_ref = p_source_ref
     limit 1;
  end if;

  if notif_id is null then
    raise exception 'create_notification_with_recipients: insert returned no id';
  end if;

  for recipient in select * from jsonb_array_elements(coalesce(p_recipients, '[]'::jsonb)) loop
    insert into public.notification_recipients (notification_id, user_id)
    values (notif_id, (recipient->>'user_id')::uuid)
    on conflict (notification_id, user_id) do nothing;
  end loop;

  for recipient in select * from jsonb_array_elements(coalesce(p_targets, '[]'::jsonb)) loop
    insert into public.notification_targets (notification_id, target_kind, target_id)
    values (notif_id,
            recipient->>'target_kind',
            nullif(recipient->>'target_id','')::uuid)
    on conflict do nothing;
  end loop;

  return notif_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 4. Description-privacy enforcement (column-level grant + views).
--    Het application-pad voor leden/ouders MOET de _public-views
--    gebruiken; tenant-admin server-actions blijven de raw tabellen
--    via service-role (createAdminClient) bevragen en zijn niet
--    onderhevig aan de column-grant.
-- ─────────────────────────────────────────────────────────────────
revoke select (description) on public.progress_modules    from authenticated, anon;
revoke select (description) on public.progress_categories from authenticated, anon;
revoke select (description) on public.progress_items      from authenticated, anon;

create or replace view public.progress_modules_public
  with (security_invoker = true) as
  select id, tenant_id, slug, name, is_active, sort_order,
         description_visibility,
         case when description_visibility = 'member' then description else null end as description,
         created_at, updated_at
    from public.progress_modules;

create or replace view public.progress_categories_public
  with (security_invoker = true) as
  select id, tenant_id, module_id, slug, name, sort_order,
         description_visibility,
         case when description_visibility = 'member' then description else null end as description,
         created_at, updated_at
    from public.progress_categories;

create or replace view public.progress_items_public
  with (security_invoker = true) as
  select id, tenant_id, category_id, slug, name, sort_order, video_url,
         description_visibility,
         case when description_visibility = 'member' then description else null end as description,
         created_at, updated_at
    from public.progress_items;

grant select on public.progress_modules_public    to authenticated;
grant select on public.progress_categories_public to authenticated;
grant select on public.progress_items_public      to authenticated;
