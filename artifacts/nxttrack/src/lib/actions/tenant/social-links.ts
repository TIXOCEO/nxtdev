"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import { createClient } from "@/lib/supabase/server";
import { SOCIAL_PLATFORM_KEYS } from "@/lib/social/catalog";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const upsertSchema = z.object({
  tenant_id: z.string().uuid(),
  platform: z.string().min(1),
  url: z.string().trim().max(500),
  is_active: z.boolean(),
  sort_order: z.number().int().default(0),
});

// Autorisatie via RLS (`tsl_admin_all` met has_tenant_access).
export async function upsertSocialLink(
  input: z.infer<typeof upsertSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  if (!SOCIAL_PLATFORM_KEYS.includes(parsed.data.platform)) {
    return { ok: false, error: "Onbekend platform" };
  }
  // Light URL validation — empty is allowed (acts as inactive placeholder).
  const url = parsed.data.url.trim();
  if (url && !/^(https?:|mailto:|tel:)/i.test(url)) {
    return { ok: false, error: "URL moet beginnen met http(s)://, mailto: of tel:" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_social_links")
    .upsert(
      {
        tenant_id: parsed.data.tenant_id,
        platform: parsed.data.platform,
        url,
        is_active: parsed.data.is_active && url.length > 0,
        sort_order: parsed.data.sort_order,
      },
      { onConflict: "tenant_id,platform" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tenant/settings/social");
  revalidatePath("/t", "layout");
  return { ok: true, data: undefined };
}

const removeSchema = z.object({
  tenant_id: z.string().uuid(),
  platform: z.string().min(1),
});
export async function deleteSocialLink(
  input: z.infer<typeof removeSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_social_links")
    .delete()
    .eq("tenant_id", input.tenant_id)
    .eq("platform", input.platform);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tenant/settings/social");
  revalidatePath("/t", "layout");
  return { ok: true, data: undefined };
}
