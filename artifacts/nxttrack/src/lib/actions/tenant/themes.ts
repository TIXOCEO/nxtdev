"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const toggleSchema = z.object({
  tenant_id: z.string().uuid(),
  theme_id: z.string().uuid(),
  enabled: z.boolean(),
});

export async function setThemeActiveForTenant(
  input: z.infer<typeof toggleSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_active_themes")
    .upsert(parsed.data, { onConflict: "tenant_id,theme_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tenant/settings/themes");
  return { ok: true, data: undefined };
}
