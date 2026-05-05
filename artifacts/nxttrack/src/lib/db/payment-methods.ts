import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentMethod } from "@/types/database";

/**
 * Sprint E — list the active (non-archived) payment methods for a tenant,
 * sorted by `sort_order`. Used in the profile Financial tab so the user
 * can pick how they pay.
 */
export async function getActivePaymentMethods(
  tenantId: string,
): Promise<PaymentMethod[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_methods")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to load payment methods: ${error.message}`);
  return (data ?? []) as PaymentMethod[];
}
