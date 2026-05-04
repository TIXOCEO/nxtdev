"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const settingsSchema = z.object({
  tenant_id: z.string().uuid(),
  default_title: z.string().trim().max(160).nullable().optional(),
  title_template: z.string().trim().max(160).nullable().optional(),
  default_description: z.string().trim().max(320).nullable().optional(),
  default_image_url: z.string().trim().url().max(500).nullable().or(z.literal("")).optional(),
  og_site_name: z.string().trim().max(120).nullable().optional(),
  twitter_handle: z.string().trim().max(60).nullable().optional(),
});

function blankToNull<T extends string | null | undefined>(v: T): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function saveTenantSeoSettings(
  input: z.infer<typeof settingsSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_seo_settings")
    .upsert(
      {
        tenant_id: parsed.data.tenant_id,
        default_title: blankToNull(parsed.data.default_title),
        title_template: blankToNull(parsed.data.title_template) ?? "%s | %tenant%",
        default_description: blankToNull(parsed.data.default_description),
        default_image_url: blankToNull(parsed.data.default_image_url),
        og_site_name: blankToNull(parsed.data.og_site_name),
        twitter_handle: blankToNull(parsed.data.twitter_handle),
      },
      { onConflict: "tenant_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tenant/settings/seo");
  return { ok: true, data: undefined };
}

const pageSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  page_path: z.string().trim().min(0).max(160),
  title: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(320).nullable().optional(),
  image_url: z.string().trim().url().max(500).nullable().or(z.literal("")).optional(),
  noindex: z.boolean().default(false),
});

export async function upsertPageSeo(
  input: z.infer<typeof pageSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const admin = createAdminClient();
  const payload = {
    tenant_id: parsed.data.tenant_id,
    page_path: parsed.data.page_path.replace(/^\/+|\/+$/g, ""),
    title: blankToNull(parsed.data.title),
    description: blankToNull(parsed.data.description),
    image_url: blankToNull(parsed.data.image_url),
    noindex: parsed.data.noindex,
  };
  const { error } = await admin
    .from("tenant_page_seo")
    .upsert(payload, { onConflict: "tenant_id,page_path" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tenant/settings/seo");
  return { ok: true, data: undefined };
}

const deletePageSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
});
export async function deletePageSeo(
  input: z.infer<typeof deletePageSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = deletePageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_page_seo")
    .delete()
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tenant/settings/seo");
  return { ok: true, data: undefined };
}
