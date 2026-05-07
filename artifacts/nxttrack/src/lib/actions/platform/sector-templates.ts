"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import {
  createSectorTemplateSchema,
  updateSectorTemplateSchema,
  deleteSectorTemplateSchema,
  setTenantSectorSchema,
  type CreateSectorTemplateInput,
  type UpdateSectorTemplateInput,
  type DeleteSectorTemplateInput,
  type SetTenantSectorInput,
} from "@/lib/validation/sector-templates";
import { safeParseTerminology } from "@/lib/terminology/schema";
import {
  seedTenantHomepageFromSector,
  type SeedHomepageResult,
} from "@/lib/db/sector-template-seed";
import { z } from "zod";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export async function createSectorTemplate(
  input: CreateSectorTemplateInput,
): Promise<ActionResult<{ key: string }>> {
  await requirePlatformAdmin();
  const parsed = createSectorTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const admin = createAdminClient();
  const { error } = await admin.from("sector_templates").insert({
    key: parsed.data.key,
    name: parsed.data.name,
    description: parsed.data.description,
    terminology_json: parsed.data.terminology_json,
    default_modules_json: parsed.data.default_modules_json,
    is_active: parsed.data.is_active,
  });
  if (error) {
    if (error.code === "23505") {
      return fail("Een template met deze key bestaat al.", { key: ["Key al in gebruik."] });
    }
    return fail(error.message);
  }
  revalidatePath("/platform/sector-templates");
  return { ok: true, data: { key: parsed.data.key } };
}

export async function updateSectorTemplate(
  input: UpdateSectorTemplateInput,
): Promise<ActionResult<{ key: string }>> {
  await requirePlatformAdmin();
  const parsed = updateSectorTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const { key, ...patch } = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin
    .from("sector_templates")
    .update(patch)
    .eq("key", key);
  if (error) return fail(error.message);
  revalidatePath("/platform/sector-templates");
  return { ok: true, data: { key } };
}

export async function deleteSectorTemplate(
  input: DeleteSectorTemplateInput,
): Promise<ActionResult<void>> {
  await requirePlatformAdmin();
  const parsed = deleteSectorTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige key");

  const admin = createAdminClient();
  // Tenants die nog naar deze key verwijzen worden door de FK
  // (`on delete set null`) automatisch teruggezet op NULL — geen extra
  // cleanup nodig.
  const { error } = await admin
    .from("sector_templates")
    .delete()
    .eq("key", parsed.data.key);
  if (error) return fail(error.message);
  revalidatePath("/platform/sector-templates");
  revalidatePath("/platform/tenants");
  return { ok: true, data: undefined };
}

/**
 * Wijst een tenant aan een sector-template toe en/of zet
 * per-tenant terminologie-overrides. Beide velden worden in één call
 * bijgewerkt zodat de UI atomair kan opslaan.
 */
export async function setTenantSector(
  input: SetTenantSectorInput,
): Promise<ActionResult<{ tenant_id: string }>> {
  await requirePlatformAdmin();
  const parsed = setTenantSectorSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const { tenant_id, sector_template_key, terminology_overrides } = parsed.data;
  const admin = createAdminClient();

  // Lees huidige settings_json en merge alleen `terminology_overrides`
  // erin, zodat andere settings (bv. theme-prefs, retentie) intact blijven.
  const { data: existing, error: readErr } = await admin
    .from("tenants")
    .select("settings_json")
    .eq("id", tenant_id)
    .maybeSingle();
  if (readErr) return fail(readErr.message);
  if (!existing) return fail("Onbekende tenant.");

  const currentSettings = (existing.settings_json ?? {}) as Record<string, unknown>;
  // Strip onbekende/lege keys via safeParse; lege object → verwijder de override-sub-key.
  const cleanedOverrides = safeParseTerminology(terminology_overrides);
  const nextSettings: Record<string, unknown> = { ...currentSettings };
  if (Object.keys(cleanedOverrides).length === 0) {
    delete nextSettings.terminology_overrides;
  } else {
    nextSettings.terminology_overrides = cleanedOverrides;
  }

  const { error: updErr } = await admin
    .from("tenants")
    .update({
      sector_template_key,
      settings_json: nextSettings,
    })
    .eq("id", tenant_id);
  if (updErr) return fail(updErr.message);

  revalidatePath(`/platform/tenants/${tenant_id}`);
  revalidatePath("/tenant/profile");
  return { ok: true, data: { tenant_id } };
}

/**
 * Sprint 39 — Platform-admin knop "Seed homepage": past de
 * `default_modules_json` van de huidige sector-template van de tenant
 * toe op `tenant_modules`. Slaat over als de tenant al modules heeft
 * (idempotent), tenzij `force` true is.
 */
const seedTenantHomepageSchema = z.object({
  tenant_id: z.string().uuid("Ongeldige tenant id"),
  force: z.boolean().optional(),
});

/**
 * Contract: retourneert `ok: true` ook voor semantische no-ops en
 * read-errors. Callers moeten `data.reason` inspecteren:
 * - `undefined` → succesvol toegepast (zie `inserted` / `skipped` /
 *   optionele `skips[]`).
 * - `no_template` | `no_modules` | `already_seeded` → no-op (geen
 *   actie nodig of geen werk te doen).
 * - `tenant_read_error` | `template_read_error` |
 *   `tenant_modules_count_error` | `catalog_read_error` →
 *   server-side read failure; `data.error` bevat de message en is ook
 *   via `console.error` gelogd. `ok: false` is gereserveerd voor
 *   authz/validatie-fouten in de action zelf.
 */
export async function seedTenantHomepage(
  input: z.infer<typeof seedTenantHomepageSchema>,
): Promise<ActionResult<SeedHomepageResult>> {
  await requirePlatformAdmin();
  const parsed = seedTenantHomepageSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const result = await seedTenantHomepageFromSector(parsed.data.tenant_id, {
    force: parsed.data.force,
  });
  revalidatePath(`/platform/tenants/${parsed.data.tenant_id}`);
  revalidatePath("/tenant/homepage");
  return { ok: true, data: result };
}
