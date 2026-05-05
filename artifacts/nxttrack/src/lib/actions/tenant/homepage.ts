"use server";

import { revalidatePath } from "next/cache";
import { assertTenantAccess } from "./_assert-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getModuleDef } from "@/lib/homepage/module-registry";
import {
  findFirstFreeSlot,
  validateLayoutItems,
} from "@/lib/homepage/validate-layout";
import {
  addTenantModuleSchema,
  updateTenantModuleSchema,
  reorderTenantModulesSchema,
  updateTenantModuleConfigSchema,
  deleteTenantModuleSchema,
  updateModuleLayoutSchema,
} from "@/lib/validation/homepage";
import type { ModuleSize, TenantModule } from "@/types/database";
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

function sizeToWh(size: ModuleSize): { w: number; h: number } {
  if (size === "2x2") return { w: 2, h: 2 };
  if (size === "2x1") return { w: 2, h: 1 };
  if (size === "1x2") return { w: 1, h: 2 };
  return { w: 1, h: 1 };
}

function whToSize(w: number, h: number): ModuleSize {
  if (w >= 2 && h >= 2) return "2x2";
  if (w >= 2) return "2x1";
  if (h >= 2) return "1x2";
  return "1x1";
}

export async function addTenantModule(
  input: z.infer<typeof addTenantModuleSchema>,
): Promise<ActionResult<{ id: string; module: TenantModule }>> {
  const parsed = addTenantModuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);

  const def = getModuleDef(parsed.data.module_key);
  if (!def) return { ok: false, error: "Onbekende module" };

  // Hero-sliders forceren 2x1.
  let chosen: ModuleSize = parsed.data.size;
  if (!def.allowedSizes.includes(chosen)) {
    if (def.allowedSizes.length === 1) chosen = def.allowedSizes[0];
    else return { ok: false, error: `Formaat ${chosen} niet toegestaan` };
  }

  const admin = createAdminClient();
  const { data: catalog } = await admin
    .from("modules_catalog")
    .select("key,is_active")
    .eq("key", parsed.data.module_key)
    .maybeSingle();
  if (!catalog || !(catalog as { is_active: boolean }).is_active) {
    return { ok: false, error: "Module is niet beschikbaar" };
  }

  // Bereken positie (x,y) op eerste vrije plek in 2D grid.
  const { data: existing } = await admin
    .from("tenant_modules")
    .select("position_x, position_y, w, h, position")
    .eq("tenant_id", parsed.data.tenant_id);
  const existingRows = (existing ?? []) as Array<{
    position_x: number;
    position_y: number;
    w: number;
    h: number;
    position: number;
  }>;
  const { w, h } = sizeToWh(chosen);
  const slot = findFirstFreeSlot(existingRows, w, h);

  // Legacy `position` kolom: hou op (max+1) zodat oude code blijft werken.
  const nextPos = existingRows.reduce((acc, r) => Math.max(acc, r.position), -1) + 1;

  const { data: ins, error } = await admin
    .from("tenant_modules")
    .insert({
      tenant_id: parsed.data.tenant_id,
      module_key: parsed.data.module_key,
      title: def.name,
      size: chosen,
      position: nextPos,
      position_x: slot.x,
      position_y: slot.y,
      w,
      h,
      visible_for: def.forcedVisibility ?? "public",
      visible_mobile: true,
      config: def.defaultConfig,
    })
    .select("*")
    .single();
  if (error || !ins) return { ok: false, error: error?.message ?? "Insert mislukt" };

  revalidateAll(await getTenantSlug(parsed.data.tenant_id));
  const row = ins as TenantModule;
  return { ok: true, data: { id: row.id, module: row } };
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
    // Synchroniseer w/h met de gekozen size, behoud x/y waar mogelijk.
    const { w, h } = sizeToWh(parsed.data.size);
    patch.w = w;
    patch.h = h;
    // Als nieuwe w niet meer past op huidige x, schuif naar 0.
    const curRow = cur as TenantModule;
    if (curRow.position_x + w > 2) patch.position_x = 0;
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
  // Sprint 22: legacy 1D reorder — alleen `position` kolom bijwerken,
  // 2D layout (x/y/w/h) loopt via updateModuleLayout.
  const parsed = reorderTenantModulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("tenant_modules")
    .select("id")
    .eq("tenant_id", parsed.data.tenant_id);
  const idSet = new Set(((rows ?? []) as Array<{ id: string }>).map((r) => r.id));
  for (const id of parsed.data.ordered_ids) {
    if (!idSet.has(id)) return { ok: false, error: "Onbekende module in volgorde" };
  }
  for (let i = 0; i < parsed.data.ordered_ids.length; i++) {
    const { error } = await admin
      .from("tenant_modules")
      .update({ position: i })
      .eq("id", parsed.data.ordered_ids[i]);
    if (error) return { ok: false, error: error.message };
  }
  revalidateAll(await getTenantSlug(parsed.data.tenant_id));
  return { ok: true, data: undefined };
}

/**
 * Sprint 22 — Sla 2D layout op (x/y/w/h per module). Server valideert
 * bounds en collisions, weigert bij overlap.
 */
export async function updateModuleLayout(
  input: z.infer<typeof updateModuleLayoutSchema>,
): Promise<ActionResult<void>> {
  const parsed = updateModuleLayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await assertTenantAccess(parsed.data.tenant_id);

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("tenant_modules")
    .select("id, module_key")
    .eq("tenant_id", parsed.data.tenant_id);
  const byId = new Map(
    ((rows ?? []) as Array<{ id: string; module_key: string }>).map((r) => [
      r.id,
      r.module_key,
    ]),
  );

  // Sprint 22 — payload moet de complete set tenant-modules dekken,
  // anders kan een partiële update overlap met niet-meegestuurde modules
  // introduceren.
  const payloadIds = new Set(parsed.data.items.map((it) => it.id));
  if (payloadIds.size !== parsed.data.items.length) {
    return { ok: false, error: "Dubbele module-id in layout." };
  }
  if (payloadIds.size !== byId.size) {
    return {
      ok: false,
      error: "Layout moet alle modules van deze tenant bevatten.",
    };
  }
  for (const id of byId.keys()) {
    if (!payloadIds.has(id)) {
      return {
        ok: false,
        error: "Layout moet alle modules van deze tenant bevatten.",
      };
    }
  }

  const items = parsed.data.items.map((it) => ({
    ...it,
    module_key: byId.get(it.id) ?? "",
  }));
  for (const it of items) {
    if (!it.module_key) {
      return { ok: false, error: `Module ${it.id} hoort niet bij deze tenant.` };
    }
  }

  const v = validateLayoutItems(items);
  if (!v.valid) return { ok: false, error: v.errors.join(" • ") };

  for (const it of items) {
    const { error } = await admin
      .from("tenant_modules")
      .update({
        position_x: it.x,
        position_y: it.y,
        w: it.w,
        h: it.h,
        // Houd legacy `size` consistent met w/h.
        size: whToSize(it.w, it.h),
      })
      .eq("id", it.id)
      .eq("tenant_id", parsed.data.tenant_id);
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
