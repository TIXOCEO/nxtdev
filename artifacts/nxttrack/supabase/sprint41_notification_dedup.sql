-- ──────────────────────────────────────────────────────────
-- Sprint 41 — Notification source-side idempotency.
--
-- Goal: one event = at most one notification, regardless of how many
-- times the trigger fires (double-click on save, retried server action,
-- overlapping cron tick, etc.).
--
-- Approach:
--   1. Partial unique index on notifications (tenant_id, source, source_ref)
--      restricted to source keys that are guaranteed to map 1:1 to a single
--      domain event. Other sources (e.g. manual, social_*, news_published)
--      are intentionally excluded — they do not have a per-event identity.
--   2. Update create_notification_with_recipients() so that a second call
--      with the same idempotency key returns the existing notification id
--      (no exception, no extra row, no extra recipients).
--
-- Idempotent. Safe to re-run.
-- ──────────────────────────────────────────────────────────

-- 1a. Backfill: legacy rows are not idempotent.
--     * Historical `group_assigned` notifications stored `source_ref = group_id`
--       (one per member added to the same group), so the same key can already
--       repeat many times.
--     * Historical `training_created` / `training_reminder` rows can also
--       have duplicates — that's the very bug this sprint fixes.
--
-- To make the partial unique index buildable without losing inbox history,
-- we keep the OLDEST row per (tenant_id, source, source_ref) intact and set
-- `source_ref = null` on every duplicate. NULL excludes the row from the
-- partial index predicate. This is purely metadata cleanup — recipient
-- delivery rows (notification_recipients) are untouched.
with ranked as (
  select id,
         row_number() over (
           partition by tenant_id, source, source_ref
           order by created_at, id
         ) as rn
    from public.notifications
   where source in ('training_created', 'training_reminder', 'group_assigned')
     and source_ref is not null
)
update public.notifications n
   set source_ref = null
  from ranked r
 where n.id = r.id
   and r.rn > 1;

-- 1b. Partial unique index on the dedup-eligible source keys.
create unique index if not exists notifications_source_idem_uq
  on public.notifications (tenant_id, source, source_ref)
  where source in ('training_created', 'training_reminder', 'group_assigned')
    and source_ref is not null;

-- 2. RPC: lookup-or-insert on the idempotency key.
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
  notif_id   uuid;
  is_dedupable boolean;
begin
  is_dedupable :=
    p_source_ref is not null
    and coalesce(p_source, '') in (
      'training_created', 'training_reminder', 'group_assigned'
    );

  -- Sprint 41 — short-circuit if a notification already exists for this
  -- (tenant, source, source_ref). Return the existing id without writing
  -- anything new (no extra recipients, no extra targets).
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

  insert into public.notifications (
    tenant_id, title, content_html, content_text,
    source, source_ref, created_by, email_sent
  )
  values (
    p_tenant_id, p_title, p_content_html, p_content_text,
    coalesce(p_source, 'manual'), p_source_ref, p_created_by, false
  )
  on conflict (tenant_id, source, source_ref)
    where source in ('training_created', 'training_reminder', 'group_assigned')
      and source_ref is not null
    do nothing
  returning id into notif_id;

  -- Lost the race against a concurrent insert — fetch the winning row.
  if notif_id is null and is_dedupable then
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

  if notif_id is null then
    raise exception 'create_notification_with_recipients: insert returned no id';
  end if;

  if p_targets is not null and jsonb_array_length(p_targets) > 0 then
    insert into public.notification_targets (notification_id, target_type, target_id)
    select
      notif_id,
      (t->>'target_type')::text,
      case when (t->>'target_type') = 'all' then null else (t->>'target_id')::text end
    from jsonb_array_elements(p_targets) as t;
  end if;

  if p_recipients is not null and jsonb_array_length(p_recipients) > 0 then
    insert into public.notification_recipients
      (notification_id, tenant_id, member_id, user_id, is_read)
    select
      notif_id,
      p_tenant_id,
      nullif(r->>'member_id','')::uuid,
      (r->>'user_id')::uuid,
      false
    from jsonb_array_elements(p_recipients) as r
    on conflict (notification_id, user_id) do nothing;
  end if;

  return notif_id;
end;
$$;

revoke all on function public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb
) from public;
grant execute on function public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb
) to service_role;
