"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { THEME_TOKEN_KEYS } from "@/lib/themes/defaults";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const tokensSchema = z.record(z.string(), z.string().max(120));

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  scope: z.enum(["platform", "tenant"]),
  tenant_id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(80),
  mode: z.enum(["light", "dark"]),
  tokens: tokensSchema,
  is_default: z.boolean().default(false),
});

function normalizeTokens(raw: Record<string, string>): Record<string, string> {
  // Keep only the canonical keys we expose in the editor.
  const out: Record<string, string> = {};
  for (const k of THEME_TOKEN_KEYS) {
    const v = raw[k];
    if (typeof v === "string" && v.trim().length > 0) out[k] = v.trim();
  }
  return out;
}

export async function upsertTheme(
  input: z.infer<typeof upsertSchema>,
): Promise<ActionResult<{ id: string }>> {
  await requirePlatformAdmin();
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const { id, scope, tenant_id, name, mode, tokens, is_default } = parsed.data;
  if (scope === "platform" && tenant_id !== null) {
    return { ok: false, error: "Platform-thema mag geen tenant hebben." };
  }
  if (scope === "tenant" && !tenant_id) {
    return { ok: false, error: "Tenant-thema vereist een tenant." };
  }

  const admin = createAdminClient();
  if (scope === "tenant" && tenant_id) {
    const { data: t } = await admin
      .from("tenants")
      .select("id")
      .eq("id", tenant_id)
      .maybeSingle();
    if (!t) return { ok: false, error: "Onbekende tenant." };
  }
  const payload = {
    scope,
    tenant_id,
    name,
    mode,
    tokens: normalizeTokens(tokens),
    is_default,
  };

  if (id) {
    const { error } = await admin.from("themes").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/platform/themes");
    return { ok: true, data: { id } };
  }
  const { data, error } = await admin.from("themes").insert(payload).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/platform/themes");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

const deleteSchema = z.object({ id: z.string().uuid() });
export async function deleteTheme(
  input: z.infer<typeof deleteSchema>,
): Promise<ActionResult<void>> {
  await requirePlatformAdmin();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige id" };
  const admin = createAdminClient();
  const { error } = await admin.from("themes").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/platform/themes");
  return { ok: true, data: undefined };
}
