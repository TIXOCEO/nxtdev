"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const auditRetentionSchema = z.object({
  tenant_id: z.string().uuid(),
  months: z
    .number()
    .int()
    .min(0, "Bewaartermijn mag niet negatief zijn.")
    .nullable(),
});

export type AuditRetentionInput = z.infer<typeof auditRetentionSchema>;

/**
 * Tenant-admin action to update `tenants.audit_retention_months`.
 * `null` = "nooit opschonen", `0` = bij eerstvolgende run alles opruimen,
 * `>0` = aantal maanden bewaren.
 */
export async function updateAuditRetention(
  input: AuditRetentionInput,
): Promise<ActionResult<{ months: number | null }>> {
  const parsed = auditRetentionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ongeldige invoer.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { data: priorRow } = await supabase
    .from("tenants")
    .select("audit_retention_months")
    .eq("id", parsed.data.tenant_id)
    .maybeSingle();

  const prior =
    (priorRow as { audit_retention_months: number | null } | null)
      ?.audit_retention_months ?? null;

  const next = parsed.data.months;

  if (prior === next) {
    return { ok: true, data: { months: next } };
  }

  const { error } = await supabase
    .from("tenants")
    .update({ audit_retention_months: next })
    .eq("id", parsed.data.tenant_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "tenant_profile.audit_retention.update",
    meta: {
      previous_months: prior,
      new_months: next,
    },
  });

  revalidatePath("/tenant/audit");
  revalidatePath("/tenant/profile");

  return { ok: true, data: { months: next } };
}
