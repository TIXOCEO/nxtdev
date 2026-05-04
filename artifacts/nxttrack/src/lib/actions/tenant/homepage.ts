"use server";

import { revalidatePath } from "next/cache";
import { assertTenantAccess } from "./_assert-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getModuleDef } from "@/lib/homepage/module-registry";
import { validateLayout } from "@/lib/homepage/validate-layout";
import {
  addTenantModuleSchema,
  updateTenantModuleSchema,
  reorderTenantModulesSchema,
  updateTenantModuleConfigSchema,
  deleteTenantModuleSchema,
} from "@/lib/validation/homepage";
import type { TenantModule } from "@/types/database";
import type { z } from "zod";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateAll(slug?: string) {
  revalidatePath("/tenant/homepage");
  if (slug) revalidatePath(`/t/${slug}`);
  revalidatePath("/t", "layout");
}

async function getTenantSlug(tenantId: string): Promise<string | undefined> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .maybeSingle();
  return (data as { slug: string } | null)?.slug;
}

export async function addTenantModule(
  input: z.infer<typeof addTenantModuleSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addTenantModuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);

  const def = getModuleDef(parsed.data.module_key);
  if (!def) return { ok: false, error: "Onbekende module" };

  const admin = createAdminClient();
  const { data: catalog } = await admin
    .from("modules_catalog")
    .select("key,is_active")
    .eq("key", parsed.data.module_key)
    .maybeSingle();
  if (!catalog || !(catalog as { is_active: boolean }).is_active) {
    return { ok: false, error: "Module is niet beschikbaar" };
  }

  const { data: maxRow } = await admin
    .from("tenant_modules")
    .select("position")
    .eq("tenant_id", parsed.data.tenant_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = ((maxRow as { position: number } | null)?.position ?? -1) + 1;

  const { data: ins, error } = await admin
    .from("tenant_modules")
    .insert({
      tenant_id: parsed.data.tenant_id,
      module_key: parsed.data.module_key,
      title: def.name,
      size: def.defaultSize,
      position: nextPos,
      visible_for: def.forcedVisibility ?? "public",
      visible_mobile: true,
      config: def.defaultConfig,
    })
    .select("id")
    .single();
  if (error || !ins) return { ok: false, error: error?.message ?? "Insert mislukt" };

  revalidateAll(await getTenantSlug(parsed.data.tenant_id));
  return { ok: true, data: { id: (ins as { id: string }).id } };
}

export async function updateTenantModule(
  input: z.infer<typeof updateTenantModuleSchema>,
): Promise<ActionResult<void>> {
  const parsed = updateTenantModuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);

  const admin = createAdminClient();
  const { data: cur } = await admin
    .from("tenant_modules")
    .select("*")
    .eq("id", parsed.data.module_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!cur) return { ok: false, error: "Module niet gevonden" };

  const def = getModuleDef((cur as TenantModule).module_key);
  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.size !== undefined) {
    if (def && !def.allowedSizes.includes(parsed.data.size)) {
      return { ok: false, error: `Formaat ${parsed.data.size} niet toegestaan voor deze module` };
    }
    patch.size = parsed.data.size;
  }
  if (parsed.data.visible_for !== undefined) {
    patch.visible_for = def?.forcedVisibility ?? parsed.data.visible_for;
  }
  if (parsed.data.visible_mobile !== undefined) patch.visible_mobile = parsed.data.visible_mobile;

  if (Object.keys(patch).length === 0) return { ok: true, data: undefined };
  const { error } = await admin
    .from("tenant_modules")
    .update(patch)
    .eq("id", parsed.data.module_id);
  if (error) return { ok: false, error: error.message };

  revalidateAll(await getTenantSlug(parsed.data.tenant_id));
  return { ok: true, data: undefined };
}

export async function deleteTenantModule(
  input: z.infer<typeof deleteTenantModuleSchema>,
): Promise<ActionResult<void>> {
  const parsed = deleteTenantModuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_modules")
    .delete()
    .eq("id", parsed.data.module_id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidateAll(await getTenantSlug(parsed.data.tenant_id));
  return { ok: true, data: undefined };
}

export async function reorderTenantModules(
  input: z.infer<typeof reorderTenantModulesSchema>,
): Promise<ActionResult<void>> {
  const parsed = reorderTenantModulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("tenant_modules")
    .select("*")
    .eq("tenant_id", parsed.data.tenant_id);
  const all = (rows ?? []) as TenantModule[];
  const idSet = new Set(all.map((r) => r.id));
  for (const id of parsed.data.ordered_ids) {
    if (!idSet.has(id)) return { ok: false, error: "Onbekende module in volgorde" };
  }

  const reordered: TenantModule[] = parsed.data.ordered_ids.map((id, idx) => {
    const r = all.find((x) => x.id === id)!;
    return { ...r, position: idx };
  });
  const v = validateLayout(reordered);
  if (!v.valid) return { ok: false, error: v.errors.join(" • ") };

  // Apply positions one-by-one (small N).
  for (const r of reordered) {
    const { error } = await admin
      .from("tenant_modules")
      .update({ position: r.position })
      .eq("id", r.id);
    if (error) return { ok: false, error: error.message };
  }
  revalidateAll(await getTenantSlug(parsed.data.tenant_id));
  return { ok: true, data: undefined };
}

export async function updateTenantModuleConfig(
  input: z.infer<typeof updateTenantModuleConfigSchema>,
): Promise<ActionResult<void>> {
  const parsed = updateTenantModuleConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_modules")
    .update({ config: parsed.data.config })
    .eq("id", parsed.data.module_id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidateAll(await getTenantSlug(parsed.data.tenant_id));
  return { ok: true, data: undefined };
}

export async function toggleTenantModuleMobileVisibility(input: {
  tenant_id: string;
  module_id: string;
  visible_mobile: boolean;
}): Promise<ActionResult<void>> {
  return updateTenantModule({
    tenant_id: input.tenant_id,
    module_id: input.module_id,
    visible_mobile: input.visible_mobile,
  });
}

export async function updateTenantModuleVisibility(input: {
  tenant_id: string;
  module_id: string;
  visible_for: "public" | "logged_in";
}): Promise<ActionResult<void>> {
  return updateTenantModule({
    tenant_id: input.tenant_id,
    module_id: input.module_id,
    visible_for: input.visible_for,
  });
}
