-- ──────────────────────────────────────────────────────────
-- Sprint 43 — Extend notification source-side idempotency to the
-- remaining triggers with a natural 1-on-1 event identity.
--
-- Sprint 41 introduced the partial unique index
-- `notifications_source_idem_uq` on (tenant_id, source, source_ref)
-- but only for `training_created`, `training_reminder`, `group_assigned`.
--
-- These additional triggers also fire from places that can be retried
-- or double-clicked, and each has a per-event id we can use as
-- `source_ref`:
--
--   * news_published              -> news_posts.id (the post itself)
--   * membership_assigned         -> member_memberships.id (the row)
--   * invite_accepted             -> member_invites.id (one-shot per invite)
--   * attendance_changed_late     -> training_attendance.id (per member+session)
--   * trainer_attendance_updated  -> training_attendance.id (per member+session)
--
-- The two attendance triggers previously used `training_sessions.id`,
-- which made *legitimate* notifications for different members in the
-- same session collide. The TS callers in this sprint pass the
-- training_attendance row id instead (mirroring how Sprint 41 fixed
-- group_assigned by switching to group_members.id).
--
-- Idempotent. Safe to re-run.
-- ──────────────────────────────────────────────────────────

-- 1. Backfill: dedupe legacy rows for the newly-tracked source keys so
--    the extended partial unique index can be (re)built without conflict.
--    Strategy mirrors Sprint 41: keep the OLDEST row per
--    (tenant_id, source, source_ref) intact, NULL out source_ref on
--    duplicates so they fall outside the partial index predicate.
with ranked as (
  select id,
         row_number() over (
           partition by tenant_id, source, source_ref
           order by created_at, id
         ) as rn
    from public.notifications
   where source in (
           'training_created',
           'training_reminder',
           'group_assigned',
           'news_published',
           'membership_assigned',
           'invite_accepted',
           'attendance_changed_late',
           'trainer_attendance_updated'
         )
     and source_ref is not null
)
update public.notifications n
   set source_ref = null
  from ranked r
 where n.id = r.id
   and r.rn > 1;

-- 2. Replace the partial unique index with the extended source-key list.
--    A partial unique index's predicate must exactly match the
--    `on conflict ... where` predicate used by the RPC, so we drop and
--    recreate with the broader set instead of stacking a second index.
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
          'trainer_attendance_updated'
        )
    and source_ref is not null;

-- 3. RPC: same shape as Sprint 41 — short-circuit on the broader set,
--    `on conflict` predicate matches the new index predicate exactly.
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
      'training_created',
      'training_reminder',
      'group_assigned',
      'news_published',
      'membership_assigned',
      'invite_accepted',
      'attendance_changed_late',
      'trainer_attendance_updated'
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

  insert into public.notifications (
    tenant_id, title, content_html, content_text,
    source, source_ref, created_by, email_sent
  )
  values (
    p_tenant_id, p_title, p_content_html, p_content_text,
    coalesce(p_source, 'manual'), p_source_ref, p_created_by, false
  )
  on conflict (tenant_id, source, source_ref)
    where source in (
            'training_created',
            'training_reminder',
            'group_assigned',
            'news_published',
            'membership_assigned',
            'invite_accepted',
            'attendance_changed_late',
            'trainer_attendance_updated'
          )
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
