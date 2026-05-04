import { createClient } from "@/lib/supabase/server";
import type { MembershipPlan } from "@/types/database";

export async function getPlansByTenant(tenantId: string): Promise<MembershipPlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch plans: ${error.message}`);
  return (data ?? []) as MembershipPlan[];
}
