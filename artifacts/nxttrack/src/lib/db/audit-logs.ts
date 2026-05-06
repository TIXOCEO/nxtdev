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
