"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import type { TenantPushSettings } from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const tenantPushSchema = z.object({
  tenant_id: z.string().uuid(),
  push_enabled: z.boolean(),
  default_push_on_manual: z.boolean(),
  event_overrides: z.record(z.string(), z.boolean()),
});

export async function saveTenantPushSettings(
  input: z.infer<typeof tenantPushSchema>,
): Promise<ActionResult<TenantPushSettings>> {
  const parsed = tenantPushSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ongeldige invoer",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenant_push_settings")
    .upsert(
      {
        tenant_id: parsed.data.tenant_id,
        push_enabled: parsed.data.push_enabled,
        default_push_on_manual: parsed.data.default_push_on_manual,
        event_overrides: parsed.data.event_overrides,
      },
      { onConflict: "tenant_id" },
    )
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Kon instellingen niet opslaan." };
  }
  revalidatePath("/tenant/settings/push");
  return { ok: true, data: data as TenantPushSettings };
}
