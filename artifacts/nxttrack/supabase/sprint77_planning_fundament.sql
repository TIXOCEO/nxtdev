-- ============================================================================
-- Sprint 77 — Backend-fundament fase 6 (parent-portal) + fase 7 (drag-n-drop agenda)
-- Optie B: incl. training_attendance_notes met visibility (internal/external)
--           + parent-RLS via member_links.
-- ============================================================================
-- Idempotent (drop+recreate voor functies/indexen, add column if not exists voor kolommen).
-- Pattern: Sprint 41/43/53/55/57/64/65/66/73/74/76.
--
-- Inhoud:
--   A) Notification dedup-keys uitbreiden met 6 child_* keys voor fase 6.
--      (Parent-routing zelf gebeurt al in lib/notifications/resolve-recipients.ts
--       via member_links — geen SQL-uitbreiding nodig daar.)
--   B) training_attendance_notes-tabel + RLS + RPC upsert_member_note.
--   C) training_sessions.lock_version + get_planning_window RPC.
--   D) preview_move_session + move_session RPCs (conflict-detectie + optimistic
--      locking).
-- ============================================================================

set search_path = public;

-- ============================================================================
-- A) Notification dedup-keys
-- ============================================================================

-- Drop+recreate partial unique index met de 6 nieuwe child_* keys.
drop index if exists public.notifications_source_idem_uq;
create unique index notifications_source_idem_uq
  on public.notifications (tenant_id, source, source_ref)
  where source = any (array[
    -- Bestaande keys (Sprint 41/43/53/55/57/64/65/66/73/74/76):
    'training_created','training_reminder','group_assigned','news_published',
    'membership_assigned','invite_accepted','attendance_changed_late',
    'trainer_attendance_updated','waitlist_offer_sent','waitlist_offer_accepted',
    'waitlist_offer_declined','makeup_credit_granted','makeup_request_approved',
    'makeup_request_declined','milestone_event_invited','milestone_event_result_published',
    'certificate_issued','progress_milestone_reached','instructor_assignment_added',
    'instructor_assignment_removed','substitute_assigned','waitlist_entry_program_assigned',
    'intake_submission_created','intake_submission_needs_review',
    'intake_submission_auto_waitlisted','intake_slot_offered','intake_slot_accepted',
    'intake_slot_declined','capacity_available_candidates',
    -- Sprint 77 (fase 6 parent-portal fundament):
    'child_attendance_recorded','child_attendance_missed','child_session_cancelled',
    'child_membership_expiring','child_placement_offered','child_note_published'
  ]) and source_ref is not null;

-- RPC: dezelfde array in de function-body's dedup-check.
-- Signature blijft 10-param (Sprint 76g, push_url).
drop function if exists public.create_notification_with_recipients(
  uuid, text, text, text, text, uuid, uuid, jsonb, jsonb, text);

create or replace function public.create_notification_with_recipients(
  p_tenant_id     uuid,
  p_title         text,
  p_content_html  text,
  p_content_text  text,
  p_source        text,
  p_source_ref    uuid,
  p_created_by    uuid,
  p_targets       jsonb,
  p_recipients    jsonb,
  p_push_url      text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  notif_id     uuid;
  is_dedupable boolean;
  recipient    jsonb;
  target       jsonb;
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
      'progress_milestone_reached',
      'intake_submission_received','intake_status_changed',
      'intake_slot_offered','intake_slot_accepted','intake_slot_declined',
      'capacity_available_candidates',
      -- Sprint 77 child_* keys:
      'child_attendance_recorded','child_attendance_missed','child_session_cancelled',
      'child_membership_expiring','child_placement_offered','child_note_published'
    );

  if is_dedupable then
    select id into notif_id
      from public.notifications
     where tenant_id = p_tenant_id
       and source = p_source
       and source_ref = p_source_ref
     limit 1;
    if notif_id is not null then
      return notif_id;
    end if;
  end if;

  insert into public.notifications (
    tenant_id, title, content_html, content_text,
    source, source_ref, push_url, created_by, email_sent
  ) values (
    p_tenant_id, p_title, p_content_html, p_content_text,
    coalesce(p_source, 'manual'), p_source_ref, p_push_url, p_created_by, false
  )
  returning id into notif_id;

  if notif_id is null then
    raise exception 'create_notification_with_recipients: insert returned no id';
  end if;

  if p_targets is not null and jsonb_array_length(p_targets) > 0 then
    for target in select * from jsonb_array_elements(p_targets) loop
      insert into public.notification_targets (notification_id, target_type, target_id)
      values (
        notif_id,
        target->>'target_type',
        nullif(target->>'target_id', '')
      );
    end loop;
  end if;

  if p_recipients is not null and jsonb_array_length(p_recipients) > 0 then
    for recipient in select * from jsonb_array_elements(p_recipients) loop
      begin
        insert into public.notification_recipients
          (notification_id, tenant_id, member_id, user_id)
        values (
          notif_id,
          p_tenant_id,
          nullif(recipient->>'member_id','')::uuid,
          (recipient->>'user_id')::uuid
        );
      exception when unique_violation then
        null;
      end;
    end loop;
  end if;

  return notif_id;
end
$function$;

-- ============================================================================
-- B) training_attendance_notes — sessie-gebonden notitie per lid
-- ============================================================================

create table if not exists public.training_attendance_notes (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  session_id       uuid not null,
  member_id        uuid not null,
  visibility       text not null check (visibility in ('internal','external')),
  body             text not null check (length(body) between 1 and 4000),
  author_member_id uuid,
  author_user_id   uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- composite-FK pattern (Sprint 60+) — voorkomt cross-tenant koppeling
  constraint training_attendance_notes_tenant_fk
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint training_attendance_notes_session_fk
    foreign key (session_id, tenant_id)
    references public.training_sessions(id, tenant_id) on delete cascade,
  constraint training_attendance_notes_member_fk
    foreign key (member_id, tenant_id)
    references public.members(id, tenant_id) on delete cascade
);

-- Eén notitie per (session, member, visibility) — een trainer schrijft één
-- interne en/of één externe regel per leerling per sessie. Een nieuwe upsert
-- overschrijft de body.
create unique index if not exists training_attendance_notes_unique_per_visibility
  on public.training_attendance_notes (session_id, member_id, visibility);

-- Partial index voor de parent-feed (alleen external) op member-tijdlijn.
create index if not exists training_attendance_notes_member_ext_idx
  on public.training_attendance_notes (member_id, created_at desc)
  where visibility = 'external';

-- Tenant-scope index voor admin-listings.
create index if not exists training_attendance_notes_tenant_session_idx
  on public.training_attendance_notes (tenant_id, session_id);

-- updated_at-trigger (hergebruik bestaande helper indien aanwezig).
drop trigger if exists trg_training_attendance_notes_updated on public.training_attendance_notes;
create or replace function public._set_updated_at_training_attendance_notes()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_training_attendance_notes_updated
  before update on public.training_attendance_notes
  for each row execute function public._set_updated_at_training_attendance_notes();

-- RLS
alter table public.training_attendance_notes enable row level security;

drop policy if exists training_attendance_notes_select_staff on public.training_attendance_notes;
create policy training_attendance_notes_select_staff
  on public.training_attendance_notes for select to authenticated
  using ( public.has_tenant_access(tenant_id) );

drop policy if exists training_attendance_notes_select_member_self on public.training_attendance_notes;
create policy training_attendance_notes_select_member_self
  on public.training_attendance_notes for select to authenticated
  using (
    visibility = 'external'
    and exists (
      select 1 from public.members m
       where m.id = training_attendance_notes.member_id
         and m.tenant_id = training_attendance_notes.tenant_id
         and m.user_id = auth.uid()
    )
  );

drop policy if exists training_attendance_notes_select_parent on public.training_attendance_notes;
create policy training_attendance_notes_select_parent
  on public.training_attendance_notes for select to authenticated
  using (
    visibility = 'external'
    and exists (
      select 1
        from public.member_links ml
        join public.members parent on parent.id = ml.parent_member_id
       where ml.tenant_id = training_attendance_notes.tenant_id
         and ml.child_member_id = training_attendance_notes.member_id
         and parent.user_id = auth.uid()
    )
  );

-- Schrijven uitsluitend via de RPC (security definer). Geen direct insert/update
-- voor authenticated.
drop policy if exists training_attendance_notes_no_direct_write on public.training_attendance_notes;
create policy training_attendance_notes_no_direct_write
  on public.training_attendance_notes for all to authenticated
  using ( false ) with check ( false );

grant select on public.training_attendance_notes to authenticated;

-- RPC: upsert_member_note
drop function if exists public.upsert_member_note(uuid, uuid, text, text);

create or replace function public.upsert_member_note(
  p_session_id uuid,
  p_member_id  uuid,
  p_visibility text,
  p_body       text
) returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tenant_id        uuid;
  v_session_tenant   uuid;
  v_member_tenant    uuid;
  v_author_user_id   uuid := auth.uid();
  v_author_member_id uuid;
  v_note_id          uuid;
begin
  if p_visibility not in ('internal','external') then
    raise exception 'upsert_member_note: invalid visibility %', p_visibility;
  end if;

  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'upsert_member_note: body is empty';
  end if;

  -- Resolve tenant via session (single source of truth)
  select tenant_id into v_session_tenant
    from public.training_sessions where id = p_session_id;
  if v_session_tenant is null then
    raise exception 'upsert_member_note: session not found';
  end if;

  select tenant_id into v_member_tenant
    from public.members where id = p_member_id;
  if v_member_tenant is null then
    raise exception 'upsert_member_note: member not found';
  end if;

  if v_session_tenant <> v_member_tenant then
    raise exception 'upsert_member_note: cross-tenant mismatch';
  end if;

  v_tenant_id := v_session_tenant;

  if not public.has_tenant_access(v_tenant_id) then
    raise exception 'upsert_member_note: forbidden';
  end if;

  -- Author-member-resolve (best-effort; nullable als de schrijver geen lid is)
  select id into v_author_member_id
    from public.members
   where tenant_id = v_tenant_id and user_id = v_author_user_id
   limit 1;

  insert into public.training_attendance_notes
    (tenant_id, session_id, member_id, visibility, body, author_member_id, author_user_id)
  values
    (v_tenant_id, p_session_id, p_member_id, p_visibility, p_body, v_author_member_id, v_author_user_id)
  on conflict (session_id, member_id, visibility) do update
    set body = excluded.body,
        author_member_id = excluded.author_member_id,
        author_user_id = excluded.author_user_id,
        updated_at = now()
  returning id into v_note_id;

  return v_note_id;
end
$function$;

revoke all on function public.upsert_member_note(uuid, uuid, text, text) from public;
grant execute on function public.upsert_member_note(uuid, uuid, text, text) to authenticated;

-- ============================================================================
-- C) training_sessions.lock_version + get_planning_window
-- ============================================================================

alter table public.training_sessions
  add column if not exists lock_version integer not null default 0;

-- Index voor week/dag-views (tenant + tijdrange).
create index if not exists training_sessions_tenant_starts_idx
  on public.training_sessions (tenant_id, starts_at);

-- get_planning_window — één RPC die alle agenda-data ophaalt in één call.
drop function if exists public.get_planning_window(uuid, timestamptz, timestamptz);

create or replace function public.get_planning_window(
  p_tenant_id uuid,
  p_from      timestamptz,
  p_to        timestamptz
) returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $function$
declare
  v_sessions    jsonb;
  v_resources   jsonb;
  v_instructors jsonb;
  v_groups      jsonb;
begin
  if not public.has_tenant_access(p_tenant_id) then
    raise exception 'get_planning_window: forbidden';
  end if;

  if p_to <= p_from then
    raise exception 'get_planning_window: to must be after from';
  end if;

  -- Cap window op 35 dagen om abuse / N+1-renders te beperken.
  if p_to > p_from + interval '35 days' then
    raise exception 'get_planning_window: window too large (max 35 days)';
  end if;

  select coalesce(jsonb_agg(s.row), '[]'::jsonb) into v_sessions
  from (
    select jsonb_build_object(
      'id', ts.id,
      'tenant_id', ts.tenant_id,
      'group_id', ts.group_id,
      'starts_at', ts.starts_at,
      'ends_at', ts.ends_at,
      'status', ts.status,
      'lock_version', ts.lock_version
    ) as row
    from public.training_sessions ts
    where ts.tenant_id = p_tenant_id
      and ts.starts_at < p_to
      and ts.ends_at   > p_from
    order by ts.starts_at
  ) s;

  select coalesce(jsonb_agg(r.row), '[]'::jsonb) into v_resources
  from (
    select jsonb_build_object(
      'id', sr.id,
      'session_id', sr.session_id,
      'resource_id', sr.resource_id,
      'starts_at', sr.starts_at,
      'ends_at', sr.ends_at,
      'max_participants', sr.max_participants
    ) as row
    from public.session_resources sr
    join public.training_sessions ts
      on ts.id = sr.session_id and ts.tenant_id = sr.tenant_id
    where sr.tenant_id = p_tenant_id
      and ts.starts_at < p_to
      and ts.ends_at   > p_from
  ) r;

  select coalesce(jsonb_agg(i.row), '[]'::jsonb) into v_instructors
  from (
    select jsonb_build_object(
      'id', si.id,
      'session_id', si.session_id,
      'member_id', si.member_id,
      'assignment_type', si.assignment_type
    ) as row
    from public.session_instructors si
    join public.training_sessions ts
      on ts.id = si.session_id and ts.tenant_id = si.tenant_id
    where si.tenant_id = p_tenant_id
      and ts.starts_at < p_to
      and ts.ends_at   > p_from
  ) i;

  select coalesce(jsonb_agg(g.row), '[]'::jsonb) into v_groups
  from (
    select distinct jsonb_build_object(
      'id', gr.id,
      'name', gr.name
    ) as row
    from public.groups gr
    join public.training_sessions ts
      on ts.group_id = gr.id and ts.tenant_id = gr.tenant_id
    where gr.tenant_id = p_tenant_id
      and ts.starts_at < p_to
      and ts.ends_at   > p_from
  ) g;

  return jsonb_build_object(
    'sessions', v_sessions,
    'resources', v_resources,
    'instructors', v_instructors,
    'groups', v_groups
  );
end
$function$;

revoke all on function public.get_planning_window(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_planning_window(uuid, timestamptz, timestamptz) to authenticated;

-- ============================================================================
-- D) preview_move_session + move_session — conflict-detectie + optimistic lock
-- ============================================================================

-- Helper: bereken conflicts voor een hypothetische move.
-- Returnt jsonb-array van {type: 'resource'|'instructor', ...details}.
drop function if exists public._compute_move_conflicts(uuid, timestamptz, timestamptz);

create or replace function public._compute_move_conflicts(
  p_session_id   uuid,
  p_new_starts   timestamptz,
  p_new_ends     timestamptz
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant_id  uuid;
  v_old_starts timestamptz;
  v_old_ends   timestamptz;
  v_resource_conflicts   jsonb;
  v_instructor_conflicts jsonb;
begin
  select tenant_id, starts_at, ends_at
    into v_tenant_id, v_old_starts, v_old_ends
    from public.training_sessions where id = p_session_id;

  if v_tenant_id is null then
    raise exception '_compute_move_conflicts: session not found';
  end if;

  -- Resource-conflicten: voor élke resource die aan deze sessie hangt,
  -- check of een ANDERE session_resources-rij (zelfde resource) overlapt met
  -- het nieuwe sessie-venster. Resource-boekingen die geen eigen starts_at
  -- hebben volgen impliciet de sessie zelf — die slaan we over.
  select coalesce(jsonb_agg(rc.row), '[]'::jsonb)
    into v_resource_conflicts
  from (
    select distinct jsonb_build_object(
      'type', 'resource',
      'resource_id', other.resource_id,
      'conflicting_session_id', other.session_id,
      'conflicting_starts_at', other.starts_at,
      'conflicting_ends_at', other.ends_at
    ) as row
    from public.session_resources mine
    join public.session_resources other
      on other.resource_id = mine.resource_id
     and other.session_id <> mine.session_id
     and other.tenant_id  = mine.tenant_id
     and other.starts_at is not null
     and other.ends_at   is not null
     and tstzrange(other.starts_at, other.ends_at, '[)')
         && tstzrange(p_new_starts, p_new_ends, '[)')
    where mine.session_id = p_session_id
      and mine.tenant_id  = v_tenant_id
  ) rc;

  -- Instructor-conflicten: voor élke instructor op deze sessie, check of de
  -- instructor in een ANDERE sessie zit binnen het nieuwe venster.
  select coalesce(jsonb_agg(ic.row), '[]'::jsonb)
    into v_instructor_conflicts
  from (
    select distinct jsonb_build_object(
      'type', 'instructor',
      'member_id', mine.member_id,
      'conflicting_session_id', other_ts.id,
      'conflicting_starts_at', other_ts.starts_at,
      'conflicting_ends_at', other_ts.ends_at
    ) as row
    from public.session_instructors mine
    join public.session_instructors other
      on other.member_id = mine.member_id
     and other.session_id <> mine.session_id
     and other.tenant_id  = mine.tenant_id
    join public.training_sessions other_ts
      on other_ts.id = other.session_id
     and other_ts.tenant_id = other.tenant_id
     and tstzrange(other_ts.starts_at, other_ts.ends_at, '[)')
         && tstzrange(p_new_starts, p_new_ends, '[)')
    where mine.session_id = p_session_id
      and mine.tenant_id  = v_tenant_id
  ) ic;

  return v_resource_conflicts || v_instructor_conflicts;
end
$function$;

-- preview_move_session — read-only dry-run voor drag-preview.
drop function if exists public.preview_move_session(uuid, timestamptz, timestamptz);

create or replace function public.preview_move_session(
  p_session_id uuid,
  p_new_starts timestamptz,
  p_new_ends   timestamptz
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_tenant_id uuid;
  v_lock_v    integer;
  v_conflicts jsonb;
begin
  if p_new_ends <= p_new_starts then
    raise exception 'preview_move_session: ends must be after starts';
  end if;

  select tenant_id, lock_version
    into v_tenant_id, v_lock_v
    from public.training_sessions where id = p_session_id;

  if v_tenant_id is null then
    raise exception 'preview_move_session: session not found';
  end if;

  if not public.has_tenant_access(v_tenant_id) then
    raise exception 'preview_move_session: forbidden';
  end if;

  v_conflicts := public._compute_move_conflicts(p_session_id, p_new_starts, p_new_ends);

  return jsonb_build_object(
    'session_id', p_session_id,
    'lock_version', v_lock_v,
    'new_starts_at', p_new_starts,
    'new_ends_at', p_new_ends,
    'conflicts', v_conflicts,
    'has_conflicts', (jsonb_array_length(v_conflicts) > 0)
  );
end
$function$;

revoke all on function public.preview_move_session(uuid, timestamptz, timestamptz) from public;
grant execute on function public.preview_move_session(uuid, timestamptz, timestamptz) to authenticated;

-- move_session — gevalideerde verplaatsing met optimistic locking.
drop function if exists public.move_session(uuid, timestamptz, timestamptz, integer, boolean);

create or replace function public.move_session(
  p_session_id             uuid,
  p_new_starts             timestamptz,
  p_new_ends               timestamptz,
  p_expected_lock_version  integer,
  p_force                  boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tenant_id  uuid;
  v_old_starts timestamptz;
  v_old_ends   timestamptz;
  v_old_lock   integer;
  v_new_lock   integer;
  v_conflicts  jsonb;
  v_actor      uuid := auth.uid();
begin
  if p_new_ends <= p_new_starts then
    raise exception 'move_session: ends must be after starts';
  end if;

  -- Lock de sessie-row om concurrent moves te serializen.
  select tenant_id, starts_at, ends_at, lock_version
    into v_tenant_id, v_old_starts, v_old_ends, v_old_lock
    from public.training_sessions
   where id = p_session_id
   for update;

  if v_tenant_id is null then
    raise exception 'move_session: session not found';
  end if;

  if not public.has_tenant_access(v_tenant_id) then
    raise exception 'move_session: forbidden';
  end if;

  if v_old_lock <> p_expected_lock_version then
    return jsonb_build_object(
      'ok', false,
      'reason', 'version_mismatch',
      'expected_lock_version', p_expected_lock_version,
      'actual_lock_version', v_old_lock
    );
  end if;

  v_conflicts := public._compute_move_conflicts(p_session_id, p_new_starts, p_new_ends);

  if jsonb_array_length(v_conflicts) > 0 and not p_force then
    -- Audit het mislukte poging.
    insert into public.audit_logs (tenant_id, actor_user_id, action, meta)
    values (
      v_tenant_id, v_actor, 'training.session.move_conflict',
      jsonb_build_object(
        'session_id', p_session_id,
        'attempted_starts_at', p_new_starts,
        'attempted_ends_at', p_new_ends,
        'conflicts', v_conflicts
      )
    );
    return jsonb_build_object(
      'ok', false,
      'reason', 'conflicts',
      'conflicts', v_conflicts
    );
  end if;

  update public.training_sessions
     set starts_at    = p_new_starts,
         ends_at      = p_new_ends,
         lock_version = lock_version + 1
   where id = p_session_id
   returning lock_version into v_new_lock;

  insert into public.audit_logs (tenant_id, actor_user_id, action, meta)
  values (
    v_tenant_id, v_actor, 'training.session.moved',
    jsonb_build_object(
      'session_id', p_session_id,
      'from_starts_at', v_old_starts,
      'from_ends_at', v_old_ends,
      'to_starts_at', p_new_starts,
      'to_ends_at', p_new_ends,
      'duration_diff_minutes',
        extract(epoch from ((p_new_ends - p_new_starts) - (v_old_ends - v_old_starts))) / 60,
      'conflicts_overridden', (jsonb_array_length(v_conflicts) > 0),
      'forced', p_force,
      'from_lock_version', v_old_lock,
      'to_lock_version', v_new_lock
    )
  );

  return jsonb_build_object(
    'ok', true,
    'session_id', p_session_id,
    'new_lock_version', v_new_lock,
    'conflicts_overridden', (jsonb_array_length(v_conflicts) > 0),
    'conflicts', v_conflicts
  );
end
$function$;

revoke all on function public.move_session(uuid, timestamptz, timestamptz, integer, boolean) from public;
grant execute on function public.move_session(uuid, timestamptz, timestamptz, integer, boolean) to authenticated;

-- ============================================================================
-- Done.
-- ============================================================================
