import { createClient } from "@/lib/supabase/server";
import type { TenantMembership } from "@/types/database";

export async function getUserMemberships(userId: string): Promise<TenantMembership[]> {
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
