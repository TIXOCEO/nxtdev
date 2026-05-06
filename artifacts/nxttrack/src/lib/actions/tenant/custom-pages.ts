"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import { slugify, findUniqueSlug } from "@/lib/utils/slug";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .transform((v) => slugify(v))
    .pipe(
      z
        .string()
        .min(1, "Slug is verplicht.")
        .max(80, "Slug is te lang.")
        .regex(slugRe, "Slug mag alleen letters, cijfers en streepjes bevatten."),
    ),
  content_html: z.string().max(100_000).default(""),
  requires_auth: z.boolean().default(false),
  is_enabled: z.boolean().default(true),
  show_in_menu: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

const RESERVED_SLUGS = new Set([
  "login",
  "logout",
  "profile",
  "instellingen",
  "notifications",
  "nieuws",
  "news",
  "schedule",
  "register",
  "inschrijven",
  "proefles",
  "invite",
  "koppel-kind",
  "manifest.webmanifest",
  "sw.js",
  "offline.html",
  "p",
]);

// Autorisatie via RLS (`tcp_tenant_all` met has_tenant_access).
export async function upsertCustomPage(
  input: z.infer<typeof upsertSchema>,
): Promise<ActionResult<{ id: string }>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const supabase = await createClient();

  // Auto-fix uniekheid binnen (tenant, parent_id). Bouwt de set van bestaande
  // slugs op die overlappen met de gewenste basis en kiest een vrije variant.
  const baseSlug = parsed.data.slug;
  const sameLevel = supabase
    .from("tenant_custom_pages")
    .select("id, slug")
    .eq("tenant_id", parsed.data.tenant_id)
    .or(`slug.eq.${baseSlug},slug.like.${baseSlug}-%`);
  const scoped =
    parsed.data.parent_id === null
      ? sameLevel.is("parent_id", null)
      : sameLevel.eq("parent_id", parsed.data.parent_id);
  const { data: takenRows } = await scoped;
  const taken = new Set<string>(
    (takenRows ?? [])
      .filter((r) => r.id !== parsed.data.id) // bij update: eigen rij negeren
      .map((r) => r.slug as string),
  );
  // Top-level slugs mogen niet botsen met ingebouwde routes.
  if (parsed.data.parent_id === null) {
    for (const r of RESERVED_SLUGS) taken.add(r);
  }
  const finalSlug = findUniqueSlug(baseSlug, taken);

  const payload = {
    tenant_id: parsed.data.tenant_id,
    parent_id: parsed.data.parent_id,
    title: parsed.data.title,
    slug: finalSlug,
    content_html: parsed.data.content_html,
    requires_auth: parsed.data.requires_auth,
    is_enabled: parsed.data.is_enabled,
    show_in_menu: parsed.data.show_in_menu,
    sort_order: parsed.data.sort_order,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("tenant_custom_pages")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("tenant_id", parsed.data.tenant_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/tenant/pages");
    return { ok: true, data: { id: parsed.data.id } };
  }
  const { data, error } = await supabase
    .from("tenant_custom_pages")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tenant/pages");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

const deleteSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
});
export async function deleteCustomPage(
  input: z.infer<typeof deleteSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige id" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_custom_pages")
    .delete()
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tenant/pages");
  return { ok: true, data: undefined };
}

const reorderSchema = z.object({
  tenant_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  ids: z.array(z.string().uuid()).min(1),
});
export async function reorderCustomPages(
  input: z.infer<typeof reorderSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const supabase = await createClient();
  // Update sort_order in declared sequence.
  let i = 0;
  for (const id of parsed.data.ids) {
    const q = supabase
      .from("tenant_custom_pages")
      .update({ sort_order: i })
      .eq("id", id)
      .eq("tenant_id", parsed.data.tenant_id);
    const filtered =
      parsed.data.parent_id === null
        ? q.is("parent_id", null)
        : q.eq("parent_id", parsed.data.parent_id);
    const { error } = await filtered;
    if (error) return { ok: false, error: error.message };
    i++;
  }
  revalidatePath("/tenant/pages");
  revalidatePath("/t", "layout");
  return { ok: true, data: undefined };
}

const toggleSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
  field: z.enum(["is_enabled", "show_in_menu", "requires_auth"]),
  value: z.boolean(),
});
export async function toggleCustomPageFlag(
  input: z.infer<typeof toggleSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_custom_pages")
    .update({ [parsed.data.field]: parsed.data.value })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tenant/pages");
  return { ok: true, data: undefined };
}
