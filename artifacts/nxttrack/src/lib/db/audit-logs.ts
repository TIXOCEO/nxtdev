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
  limit?: number;
}

/**
 * Read recent audit-log rows for a tenant. Caller MUST verify tenant access
 * before invoking — this uses the admin client and bypasses RLS for
 * efficiency (the tenant page already gates via `getActiveTenant`).
 */
export async function getAuditLogs(q: AuditQuery): Promise<AuditLogRow[]> {
  const admin = createAdminClient();
  const limit = Math.min(Math.max(q.limit ?? 200, 1), 500);

  let query = admin
    .from("audit_logs")
    .select("id, tenant_id, actor_user_id, member_id, action, meta, created_at")
    .eq("tenant_id", q.tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q.action && q.action.trim() !== "") {
    query = query.eq("action", q.action.trim());
  }
  if (q.fromDate) {
    query = query.gte("created_at", `${q.fromDate}T00:00:00Z`);
  }
  if (q.toDate) {
    // Inclusive upper bound: end of day.
    query = query.lte("created_at", `${q.toDate}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[audit-logs] query failed:", error.message);
    return [];
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

  // Hydrate actor email + member name for display. Two small lookups; we
  // de-dupe ids first to keep the count low.
  const userIds = Array.from(
    new Set(rows.map((r) => r.actor_user_id).filter((v): v is string => !!v)),
  );
  const memberIds = Array.from(
    new Set(rows.map((r) => r.member_id).filter((v): v is string => !!v)),
  );

  const emailById = new Map<string, string>();
  if (userIds.length > 0) {
    // auth.users isn't directly queryable via PostgREST; loop admin getUserById.
    // For 200 rows this stays bounded by unique-actor count and runs in parallel.
    await Promise.all(
      userIds.map(async (id) => {
        try {
          const { data: u } = await admin.auth.admin.getUserById(id);
          if (u?.user?.email) emailById.set(id, u.user.email);
        } catch {
          // ignore — leave actor email blank.
        }
      }),
    );
  }

  const memberById = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: members } = await admin
      .from("members")
      .select("id, full_name, first_name, last_name")
      .in("id", memberIds);
    for (const m of (members ?? []) as Array<{
      id: string;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
    }>) {
      const name =
        m.full_name?.trim() ||
        [m.first_name, m.last_name].filter(Boolean).join(" ").trim() ||
        m.id;
      memberById.set(m.id, name);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    actor_user_id: r.actor_user_id,
    actor_email: r.actor_user_id ? emailById.get(r.actor_user_id) ?? null : null,
    member_id: r.member_id,
    member_name: r.member_id ? memberById.get(r.member_id) ?? null : null,
    action: r.action,
    meta: (r.meta ?? {}) as Record<string, unknown>,
    created_at: r.created_at,
  }));
}

export interface AuditStreamQuery {
  tenantId: string;
  action?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  /** Page size for paginated reads. */
  pageSize?: number;
  /** Hard cap to prevent runaway exports. Default 100k. */
  maxRows?: number;
}

/**
 * Async iterator over audit-log rows for export. Paginated with
 * keyset (created_at, id) on the existing `(tenant_id, created_at desc)`
 * index so it scales beyond the 200-row UI limit. Caller MUST verify
 * tenant access — uses admin client and bypasses RLS.
 */
export async function* streamAuditLogs(
  q: AuditStreamQuery,
): AsyncGenerator<AuditLogRow, void, void> {
  const admin = createAdminClient();
  const pageSize = Math.min(Math.max(q.pageSize ?? 1000, 1), 1000);
  const maxRows = Math.max(q.maxRows ?? 100_000, 1);

  // Cache hydrated lookups across pages.
  const emailById = new Map<string, string>();
  const emailMissing = new Set<string>();
  const memberById = new Map<string, string>();
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
    if (q.fromDate) {
      query = query.gte("created_at", `${q.fromDate}T00:00:00Z`);
    }
    if (q.toDate) {
      query = query.lte("created_at", `${q.toDate}T23:59:59.999Z`);
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
          .filter((id) => !memberById.has(id) && !memberMissing.has(id)),
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
        const name =
          m.full_name?.trim() ||
          [m.first_name, m.last_name].filter(Boolean).join(" ").trim() ||
          m.id;
        memberById.set(m.id, name);
        seen.add(m.id);
      }
      for (const id of newMemberIds) if (!seen.has(id)) memberMissing.add(id);
    }

    for (const r of rows) {
      yield {
        id: r.id,
        tenant_id: r.tenant_id,
        actor_user_id: r.actor_user_id,
        actor_email: r.actor_user_id ? emailById.get(r.actor_user_id) ?? null : null,
        member_id: r.member_id,
        member_name: r.member_id ? memberById.get(r.member_id) ?? null : null,
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
