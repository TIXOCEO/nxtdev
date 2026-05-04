import { createClient } from "@/lib/supabase/server";
import type { Registration } from "@/types/database";

export async function getTenantRegistrations(
  tenantId: string,
): Promise<Registration[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch registrations: ${error.message}`);
  return (data ?? []) as Registration[];
}
