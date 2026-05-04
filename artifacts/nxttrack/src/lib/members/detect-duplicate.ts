import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberRoleName } from "@/types/database";

/**
 * Sprint 10 — Duplicate detection.
 *
 * Detects existing members in the same tenant that match by lowercase
 * email AND share at least one of the **adult-only** roles
 * (parent / trainer / staff / volunteer / adult athlete).
 *
 * Minors (athlete-only) are intentionally excluded: many minors share
 * a parent's email address, and we never want to block adding a sibling
 * because of email collision alone.
 */
export interface DuplicateCandidate {
  id: string;
  full_name: string;
  email: string | null;
  member_status: string;
  roles: string[];
}

const ADULT_ROLES: ReadonlySet<MemberRoleName> = new Set([
  "parent",
  "trainer",
  "staff",
  "volunteer",
]);

/**
 * For an `email`, find members in `tenantId` that look like duplicates.
 * Returns an empty array when:
 *   - the email is empty
 *   - the matching role set is "athlete-only" (treated as a minor)
 */
export async function detectDuplicateAdult(params: {
  tenantId: string;
  email: string;
  /** When checking *during* an invite for a known role set. */
  candidateRoles?: readonly string[];
}): Promise<DuplicateCandidate[]> {
  const email = params.email.trim().toLowerCase();
  if (!email) return [];

  // Caller is creating an athlete-only (minor) record → never flag as dupe.
  if (
    params.candidateRoles &&
    params.candidateRoles.length > 0 &&
    params.candidateRoles.every((r) => r === "athlete")
  ) {
    return [];
  }

  const admin = createAdminClient();
  const { data: members, error } = await admin
    .from("members")
    .select("id, full_name, email, member_status")
    .eq("tenant_id", params.tenantId)
    .ilike("email", email);
  if (error || !members || members.length === 0) return [];

  const ids = members.map((m) => m.id as string);
  const { data: roles } = await admin
    .from("member_roles")
    .select("member_id, role")
    .in("member_id", ids);

  const rolesByMember = new Map<string, string[]>();
  for (const r of (roles ?? []) as Array<{ member_id: string; role: string }>) {
    const arr = rolesByMember.get(r.member_id) ?? [];
    arr.push(r.role);
    rolesByMember.set(r.member_id, arr);
  }

  return members
    .map((m) => ({
      id: m.id as string,
      full_name: m.full_name as string,
      email: (m.email as string | null) ?? null,
      member_status: m.member_status as string,
      roles: rolesByMember.get(m.id as string) ?? [],
    }))
    .filter((m) => m.roles.some((r) => ADULT_ROLES.has(r as MemberRoleName)));
}
