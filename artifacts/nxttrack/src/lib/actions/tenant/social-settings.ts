"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertTenantAccess } from "./_assert-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateSocialSettingsSchema } from "@/lib/validation/social";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function updateSocialSettings(
  input: z.infer<typeof updateSocialSettingsSchema>,
): Promise<ActionResult<void>> {
  const parsed = updateSocialSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);

  const admin = createAdminClient();
  const { tenant_id, ...rest } = parsed.data;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) patch[k] = v;
  }

  // Upsert: ensure a row exists, then update flags.
  const { error: upErr } = await admin
    .from("social_settings")
    .upsert({ tenant_id, ...patch }, { onConflict: "tenant_id" });
  if (upErr) return { ok: false, error: upErr.message };

  revalidatePath("/tenant/settings/social-feed");
  revalidatePath(`/t`, "layout");
  return { ok: true, data: undefined };
}
