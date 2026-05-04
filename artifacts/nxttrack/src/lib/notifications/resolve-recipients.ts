import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationTargetType } from "@/types/database";

export interface ResolvedRecipient {
  member_id: string;
  user_id: string;
}

export interface ResolveTarget {
  target_type: NotificationTargetType | string;
  target_id?: string | null;
}

/**
 * Sprint 11: Resolve a list of notification targets into deliverable
 * recipients for a single tenant.
 *
 * Rules:
 *  1. target=member  → that member; if minor (no own user_id and has parent
 *                       link) reroute to each linked parent.
 *  2. target=group   → all members of group, then apply minor→parent rule.
 *  3. target=role    → all members carrying the role, then minor→parent.
 *  4. target=all     → every active member of the tenant, then minor→parent.
 *  5. Only members that themselves have user_id, OR a linked parent with a
 *     user_id, are kept. Recipients with neither are silently dropped.
 *  6. Final list is deduped on user_id (first-seen wins).
 *
 * Uses the service-role admin client because this runs from server actions
 * that already enforce tenant access and we must read across members /
 * member_links / member_roles / group_members regardless of caller RLS.
 */
export async function resolveRecipients(
  tenantId: string,
  targets: ResolveTarget[],
): Promise<ResolvedRecipient[]> {
  if (targets.length === 0) return [];
  const admin = createAdminClient();

  // Step 1 — collect candidate member ids per target.
  const memberIds = new Set<string>();
  let includeAll = false;

  for (const t of targets) {
    if (t.target_type === "all") {
      includeAll = true;
      break;
    }
    if (t.target_type === "member" && t.target_id) {
      memberIds.add(t.target_id);
      continue;
    }
    if (t.target_type === "group" && t.target_id) {
      const { data } = await admin
        .from("group_members")
        .select("member_id, groups!inner(tenant_id)")
        .eq("group_id", t.target_id)
        .eq("groups.tenant_id", tenantId);
      for (const row of (data ?? []) as Array<{ member_id: string }>) {
        memberIds.add(row.member_id);
      }
      continue;
    }
    if (t.target_type === "role" && t.target_id) {
      const { data } = await admin
        .from("member_roles")
        .select("member_id, members!inner(tenant_id, member_status)")
        .eq("role", t.target_id)
        .eq("members.tenant_id", tenantId);
      for (const row of (data ?? []) as Array<{ member_id: string }>) {
        memberIds.add(row.member_id);
      }
      continue;
    }
  }

  // Step 2 — load all candidate members (or every active tenant member).
  let candidateRows: Array<{ id: string; user_id: string | null; member_status: string }>;
  if (includeAll) {
    const { data } = await admin
      .from("members")
      .select("id, user_id, member_status")
      .eq("tenant_id", tenantId);
    candidateRows = (data ?? []) as typeof candidateRows;
    // Filter to active where status is set; treat missing as active.
    candidateRows = candidateRows.filter(
      (m) => !m.member_status || m.member_status === "active",
    );
  } else {
    if (memberIds.size === 0) return [];
    const { data } = await admin
      .from("members")
      .select("id, user_id, member_status")
      .eq("tenant_id", tenantId)
      .in("id", Array.from(memberIds));
    candidateRows = (data ?? []) as typeof candidateRows;
  }

  if (candidateRows.length === 0) return [];

  // Step 3 — for any candidate without a user_id, look up parent links.
  const minorIds = candidateRows.filter((m) => !m.user_id).map((m) => m.id);

  const parentByChild = new Map<string, string[]>();
  if (minorIds.length > 0) {
    const { data: links } = await admin
      .from("member_links")
      .select("parent_member_id, child_member_id")
      .eq("tenant_id", tenantId)
      .in("child_member_id", minorIds);

    const parentIds = new Set<string>();
    for (const l of (links ?? []) as Array<{
      parent_member_id: string;
      child_member_id: string;
    }>) {
      const arr = parentByChild.get(l.child_member_id) ?? [];
      arr.push(l.parent_member_id);
      parentByChild.set(l.child_member_id, arr);
      parentIds.add(l.parent_member_id);
    }

    // Pull parent rows so we can pick up their user_id.
    if (parentIds.size > 0) {
      const { data: parents } = await admin
        .from("members")
        .select("id, user_id, member_status")
        .eq("tenant_id", tenantId)
        .in("id", Array.from(parentIds));
      for (const p of (parents ?? []) as typeof candidateRows) {
        // Append parents to the candidate pool so the final emit step can
        // see their user_id alongside their member_id.
        if (!candidateRows.some((c) => c.id === p.id)) candidateRows.push(p);
      }
    }
  }

  // Step 4 — emit deduped {member_id, user_id} pairs.
  const seenUsers = new Set<string>();
  const out: ResolvedRecipient[] = [];

  const memberById = new Map(candidateRows.map((m) => [m.id, m]));

  // Helper: emit one recipient row keyed by user_id.
  const emit = (memberId: string, userId: string) => {
    if (seenUsers.has(userId)) return;
    seenUsers.add(userId);
    out.push({ member_id: memberId, user_id: userId });
  };

  for (const m of candidateRows) {
    if (m.user_id) {
      emit(m.id, m.user_id);
      continue;
    }
    // Minor — route to every linked parent that has a user_id.
    const parentIds = parentByChild.get(m.id) ?? [];
    for (const pid of parentIds) {
      const parent = memberById.get(pid);
      if (parent?.user_id) emit(parent.id, parent.user_id);
    }
  }

  return out;
}
