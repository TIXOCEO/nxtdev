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

/**
 * Sprint F — list ALL payment methods for the tenant admin manager,
 * including archived ones. Sorted by archived_at NULLs first, then by
 * sort_order. The admin UI splits the list itself.
 */
export async function getAllPaymentMethods(
  tenantId: string,
): Promise<PaymentMethod[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_methods")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load payment methods: ${error.message}`);
  return (data ?? []) as PaymentMethod[];
}
