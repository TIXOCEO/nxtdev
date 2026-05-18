"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "@/lib/actions/tenant/_assert-access";
import { recordAudit } from "@/lib/audit/log";
import { revalidatePath } from "next/cache";

export async function setPublicProposeSlots(input: {
  tenantId: string;
  enabled: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input?.tenantId) return { ok: false, error: "ongeldige invoer" };
  const user = await assertTenantAccess(input.tenantId);
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("tenants")
    .select("settings_json")
    .eq("id", input.tenantId)
    .maybeSingle();
  const current =
    ((row?.settings_json as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const next = { ...current, public_intake_propose_slots: input.enabled };
  const { error } = await admin
    .from("tenants")
    .update({ settings_json: next })
    .eq("id", input.tenantId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({
    tenant_id: input.tenantId,
    actor_user_id: user.id,
    action: "tenant.settings.intake_propose_slots",
    meta: { enabled: input.enabled },
  });
  revalidatePath("/tenant/settings/intake");
  return { ok: true };
}
