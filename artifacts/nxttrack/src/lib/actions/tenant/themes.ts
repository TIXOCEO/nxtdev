"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const toggleSchema = z.object({
  tenant_id: z.string().uuid(),
  theme_id: z.string().uuid(),
  enabled: z.boolean(),
});

// Autorisatie via RLS (`tat_tenant_all` met has_tenant_access).
export async function setThemeActiveForTenant(
  input: z.infer<typeof toggleSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_active_themes")
    .upsert(parsed.data, { onConflict: "tenant_id,theme_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tenant/settings/themes");
  return { ok: true, data: undefined };
}
