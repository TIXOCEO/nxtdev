import { createClient } from "@/lib/supabase/server";
import type { TenantMembership, Role } from "@/types/database";

/** Re-exports kept for backwards compatibility with Sprint 2 callers. */
export type MembershipRole = Role;
export type Membership = TenantMembership;

/**
 * Fetch all memberships for a given user.
 * A user may belong to multiple tenants with different roles.
 * Platform admins have a row with `tenant_id = null`.
 */
export async function getMemberships(userId: string): Promise<TenantMembership[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to fetch memberships: ${error.message}`);
  }

  return (data ?? []) as TenantMembership[];
}
