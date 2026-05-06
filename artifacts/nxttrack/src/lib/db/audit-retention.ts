import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns the configured audit-log retentie (in months) for a tenant.
 * `null` means "nooit opschonen". Falls back to `null` on error so the
 * UI can degrade gracefully.
 */
export async function getAuditRetentionMonths(
  tenantId: string,
): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("audit_retention_months")
    .eq("id", tenantId)
    .maybeSingle();

  if (error || !data) return null;
  const value = (data as { audit_retention_months: number | null })
    .audit_retention_months;
  return typeof value === "number" ? value : null;
}
