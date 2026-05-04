import { createClient } from "@/lib/supabase/server";
import type { TenantEmailSettings } from "@/types/database";

export async function getTenantEmailSettings(
  tenantId: string,
): Promise<TenantEmailSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_email_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TenantEmailSettings | null) ?? null;
}
