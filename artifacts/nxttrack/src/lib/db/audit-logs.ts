import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditLogRow {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  member_id: string | null;
  member_name: string | null;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface AuditQuery {
  tenantId: string;
  action?: string | null;
  /** ISO date (yyyy-mm-dd) inclusive lower bound. */
  fromDate?: string | null;
  /** ISO date (yyyy-mm-dd) inclusive upper bound. */
  toDate?: string | null;
  /** Case-insensitive substring filter on actor email. */
  actorQuery?: string | null;
  /** Case-insensitive substring filter on member name (full/first/last). */
  memberQuery?: string | null;
  limit?: number;
  /** Sprint 39 — beperk op één lid (voor het Logboek-tab). */
  memberId?: string | null;
}

/**
 * Read recent audit-log rows for a tenant. Caller MUST verify tenant access
 * before invoking — uses the admin client and bypasses RLS for efficiency
 * (tenant pages already gate via `getActiveTenant`).
 *
 * Implemented on top of `streamAuditLogs` so the actor/member filters apply
 * exhaustively over the full event history, not just a sampled window.
 */
export async function getAuditLogs(q: AuditQuery): Promise<AuditLogRow[]> {
  const limit = Math.min(Math.max(q.limit ?? 200, 1), 500);
  const out: AuditLogRow[] = [];
  for await (const row of streamAuditLogs({
    tenantId: q.tenantId,
    action: q.action,
    fromDate: q.fromDate,
    toDate: q.toDate,
    actorQuery: q.actorQuery,
    memberQuery: q.memberQuery,
    memberId: q.memberId,
    pageSize: 500,
    maxRows: limit,
  })) {
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export interface AuditStreamQuery {
  tenantId: string;
  action?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  /** Case-insensitive substring filter on actor email. */
  actorQuery?: string | null;
  /** Case-insensitive substring filter on member name. */
  memberQuery?: string | null;
  /** Sprint 39 — beperk op één lid (voor het Logboek-tab). */
  memberId?: string | null;
  /** Page size for paginated reads. */
  pageSize?: number;
  /** Hard cap on yielded (matched) rows. Default 100k. */
  maxRows?: number;
}

/**
 * Async iterator over audit-log rows for export. Paginated with keyset
 * (created_at, id) on the existing `(tenant_id, created_at desc)` index.
 *
 * Actor/member filters are applied **after** hydration, so every event in
 * scope is evaluated against the search needle and matches are never silently
 * dropped due to a sampling cap. The trade-off is that a low-selectivity
 * needle may scan more rows than it yields; this is acceptable for both the
 * UI (low row caps) and the export (already bounded by `maxRows`).
 *
 * Caller MUST verify tenant access — uses admin client and bypasses RLS.
 */
export async function* streamAuditLogs(
  q: AuditStreamQuery,
): AsyncGenerator<AuditLogRow, void, void> {
  const admin = createAdminClient();
  const pageSize = Math.min(Math.max(q.pageSize ?? 1000, 1), 1000);
  const maxRows = Math.max(q.maxRows ?? 100_000, 1);

  const actorNeedle = q.actorQuery?.trim().toLowerCase() || null;
  const memberNeedle = q.memberQuery?.trim().toLowerCase() || null;

  // Cache hydrated lookups across pages.
  const emailById = new Map<string, string>();
  const emailMissing = new Set<string>();
  // Cache the full set of searchable name fragments per member so that the
  // member filter can match on full_name / first_name / last_name even when
  // the rendered name only uses one of them.
  const memberNamesById = new Map<
    string,
    { display: string; haystack: string }
  >();
  const memberMissing = new Set<string>();

  let cursorCreatedAt: string | null = null;
  let cursorId: string | null = null;
  let yielded = 0;

  while (yielded < maxRows) {
    let query = admin
      .from("audit_logs")
      .select("id, tenant_id, actor_user_id, member_id, action, meta, created_at")
      .eq("tenant_id", q.tenantId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageSize);

    if (q.action && q.action.trim() !== "") {
      query = query.eq("action", q.action.trim());
    }
    if (q.memberId) {
      query = query.eq("member_id", q.memberId);
    }
    if (q.fromDate) {
      query = query.gte("created_at", `${q.fromDate}T00:00:00Z`);
    }
    if (q.toDate) {
      query = query.lte("created_at", `${q.toDate}T23:59:59.999Z`);
    }
    // When the actor filter is active, we know rows without an actor can
    // never match — push that down to the DB for free.
    if (actorNeedle) {
      query = query.not("actor_user_id", "is", null);
    }
    if (memberNeedle) {
      query = query.not("member_id", "is", null);
    }
    if (cursorCreatedAt && cursorId) {
      // Keyset: rows strictly older than the last seen row.
      query = query.or(
        `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
      );
    }

    const { data, error } = await query;
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[audit-logs] export query failed:", error.message);
      return;
    }

    const rows = (data ?? []) as Array<{
      id: string;
      tenant_id: string;
      actor_user_id: string | null;
      member_id: string | null;
      action: string;
      meta: Record<string, unknown> | null;
      created_at: string;
    }>;

    if (rows.length === 0) return;

    // Hydrate any new actor + member ids.
    const newUserIds = Array.from(
      new Set(
        rows
          .map((r) => r.actor_user_id)
          .filter((v): v is string => !!v)
          .filter((id) => !emailById.has(id) && !emailMissing.has(id)),
      ),
    );
    if (newUserIds.length > 0) {
      await Promise.all(
        newUserIds.map(async (id) => {
          try {
            const { data: u } = await admin.auth.admin.getUserById(id);
            if (u?.user?.email) emailById.set(id, u.user.email);
            else emailMissing.add(id);
          } catch {
            emailMissing.add(id);
          }
        }),
      );
    }

    const newMemberIds = Array.from(
      new Set(
        rows
          .map((r) => r.member_id)
          .filter((v): v is string => !!v)
          .filter((id) => !memberNamesById.has(id) && !memberMissing.has(id)),
      ),
    );
    if (newMemberIds.length > 0) {
      const { data: members } = await admin
        .from("members")
        .select("id, full_name, first_name, last_name")
        .in("id", newMemberIds);
      const seen = new Set<string>();
      for (const m of (members ?? []) as Array<{
        id: string;
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
      }>) {
        const display =
          m.full_name?.trim() ||
          [m.first_name, m.last_name].filter(Boolean).join(" ").trim() ||
          m.id;
        const haystack = [m.full_name, m.first_name, m.last_name]
          .filter((s): s is string => !!s)
          .join(" ")
          .toLowerCase();
        memberNamesById.set(m.id, { display, haystack });
        seen.add(m.id);
      }
      for (const id of newMemberIds) if (!seen.has(id)) memberMissing.add(id);
    }

    for (const r of rows) {
      const actorEmail = r.actor_user_id
        ? emailById.get(r.actor_user_id) ?? null
        : null;
      const memberEntry = r.member_id
        ? memberNamesById.get(r.member_id) ?? null
        : null;

      // Post-hydration filter: applied to every row in the keyset scan, so
      // matches cannot be missed due to a pre-resolution sample cap.
      if (actorNeedle) {
        const hay = actorEmail?.toLowerCase();
        if (!hay || !hay.includes(actorNeedle)) continue;
      }
      if (memberNeedle) {
        if (!memberEntry || !memberEntry.haystack.includes(memberNeedle)) {
          continue;
        }
      }

      yield {
        id: r.id,
        tenant_id: r.tenant_id,
        actor_user_id: r.actor_user_id,
        actor_email: actorEmail,
        member_id: r.member_id,
        member_name: memberEntry?.display ?? null,
        action: r.action,
        meta: (r.meta ?? {}) as Record<string, unknown>,
        created_at: r.created_at,
      };
      yielded += 1;
      if (yielded >= maxRows) return;
    }

    if (rows.length < pageSize) return;
    const last = rows[rows.length - 1];
    cursorCreatedAt = last.created_at;
    cursorId = last.id;
  }
}

/**
 * Distinct actions actually used by a tenant. Used to populate the filter
 * dropdown so admins only see existing values.
 */
export async function getDistinctAuditActions(tenantId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("audit_logs")
    .select("action")
    .eq("tenant_id", tenantId)
    .order("action", { ascending: true })
    .limit(1000);
  if (error) return [];
  const seen = new Set<string>();
  for (const row of (data ?? []) as Array<{ action: string }>) {
    seen.add(row.action);
  }
  return Array.from(seen).sort();
}
