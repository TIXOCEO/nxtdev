import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getModuleDef } from "@/lib/homepage/module-registry";
import {
  sectorTemplateModulesSchema,
  type SectorTemplateModule,
} from "@/lib/validation/sector-template-modules";
import type { ModuleSize, TenantModule } from "@/types/database";

export interface SeedHomepageSkip {
  module_key: string;
  reason: "unknown_module" | "inactive_module" | "rpc_error";
  message?: string;
}

export interface SeedHomepageResult {
  inserted: number;
  skipped: number;
  reason?:
    | "no_template"
    | "no_modules"
    | "already_seeded"
    | "tenant_read_error"
    | "template_read_error"
    | "tenant_modules_count_error"
    | "catalog_read_error"
    | "invalid_template_modules";
  skips?: SeedHomepageSkip[];
  error?: string;
}

function sizeToWh(size: ModuleSize): { w: number; h: number } {
  if (size === "2x2") return { w: 2, h: 2 };
  if (size === "2x1") return { w: 2, h: 1 };
  if (size === "1x2") return { w: 1, h: 2 };
  return { w: 1, h: 1 };
}

/**
 * Sprint 39 — past de `default_modules_json` van een sector-template toe
 * op `tenant_modules` voor één tenant. Idempotent: als de tenant al
 * minstens één module heeft slaan we de seed over (tenzij `force` true,
 * gereserveerd voor toekomstig gebruik).
 *
 * - Leest sector_template_key + default_modules_json via service-role
 *   (deze functie wordt enkel server-side aangeroepen vanuit code die
 *   zelf platform-admin / createTenant-flow al heeft geautoriseerd).
 * - Gebruikt de bestaande `add_tenant_module` RPC zodat slot-allocatie en
 *   advisory-lock door de DB wordt geregeld.
 * - Eventuele entries die niet meer bestaan in de module-registry of een
 *   ongeldige size hebben worden overgeslagen — never-throw filosofie
 *   conform terminology-resolver.
 */
export async function seedTenantHomepageFromSector(
  tenantId: string,
  opts: { force?: boolean } = {},
): Promise<SeedHomepageResult> {
  const admin = createAdminClient();

  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("sector_template_key")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantErr) {
    console.error(
      `[sector-template-seed] tenant read failed tenant=${tenantId}: ${tenantErr.message}`,
    );
    return {
      inserted: 0,
      skipped: 0,
      reason: "tenant_read_error",
      error: tenantErr.message,
    };
  }
  const sectorKey = (tenant as { sector_template_key: string | null } | null)
    ?.sector_template_key;
  if (!sectorKey) return { inserted: 0, skipped: 0, reason: "no_template" };

  const { data: tpl, error: tplErr } = await admin
    .from("sector_templates")
    .select("default_modules_json")
    .eq("key", sectorKey)
    .maybeSingle();
  if (tplErr) {
    console.error(
      `[sector-template-seed] template read failed sector=${sectorKey}: ${tplErr.message}`,
    );
    return {
      inserted: 0,
      skipped: 0,
      reason: "template_read_error",
      error: tplErr.message,
    };
  }
  const rawModules =
    (tpl as { default_modules_json: unknown } | null)?.default_modules_json ?? [];

  const parsed = sectorTemplateModulesSchema.safeParse(rawModules);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    console.error(
      `[sector-template-seed] invalid default_modules_json sector=${sectorKey}: ${msg}`,
    );
    return {
      inserted: 0,
      skipped: 0,
      reason: "invalid_template_modules",
      error: msg,
    };
  }
  const modules: SectorTemplateModule[] = parsed.data;
  if (modules.length === 0) return { inserted: 0, skipped: 0, reason: "no_modules" };

  if (!opts.force) {
    const { count, error: cntErr } = await admin
      .from("tenant_modules")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if (cntErr) {
      console.error(
        `[sector-template-seed] tenant_modules count failed tenant=${tenantId}: ${cntErr.message}`,
      );
      return {
        inserted: 0,
        skipped: 0,
        reason: "tenant_modules_count_error",
        error: cntErr.message,
      };
    }
    if ((count ?? 0) > 0) {
      return { inserted: 0, skipped: modules.length, reason: "already_seeded" };
    }
  }

  // Check modules_catalog.is_active up-front zodat de seeder dezelfde
  // gating respecteert als `add_tenant_module` (inactieve modules niet
  // meer toevoegen, ook al staan ze in een sector-template).
  const keys = Array.from(new Set(modules.map((m) => m.module_key)));
  const { data: catalogRows, error: catErr } = await admin
    .from("modules_catalog")
    .select("key, is_active")
    .in("key", keys);
  if (catErr) {
    console.error(
      `[sector-template-seed] modules_catalog read failed tenant=${tenantId}: ${catErr.message}`,
    );
    return {
      inserted: 0,
      skipped: 0,
      reason: "catalog_read_error",
      error: catErr.message,
    };
  }
  const activeKeys = new Set(
    ((catalogRows ?? []) as { key: string; is_active: boolean }[])
      .filter((r) => r.is_active)
      .map((r) => r.key),
  );

  let inserted = 0;
  let skipped = 0;
  const skips: SeedHomepageSkip[] = [];
  for (const m of modules) {
    const def = getModuleDef(m.module_key);
    if (!def) {
      skipped += 1;
      skips.push({ module_key: m.module_key, reason: "unknown_module" });
      continue;
    }
    if (!activeKeys.has(m.module_key)) {
      skipped += 1;
      skips.push({ module_key: m.module_key, reason: "inactive_module" });
      continue;
    }
    const { w, h } = sizeToWh(m.size);
    const { error } = await admin
      .rpc("add_tenant_module", {
        p_tenant_id: tenantId,
        p_module_key: m.module_key,
        p_title: m.title ?? def.name,
        p_size: m.size,
        p_w: w,
        p_h: h,
        p_visible_for: def.forcedVisibility ?? m.visible_for ?? "public",
        p_visible_mobile: m.visible_mobile ?? true,
        p_config: { ...(def.defaultConfig ?? {}), ...(m.config ?? {}) },
      })
      .single<TenantModule>();
    if (error) {
      skipped += 1;
      skips.push({
        module_key: m.module_key,
        reason: "rpc_error",
        message: error.message,
      });
      continue;
    }
    inserted += 1;
  }
  if (skips.length > 0) {
    console.warn(
      `[sector-template-seed] tenant=${tenantId} sector=${sectorKey} ` +
        `inserted=${inserted} skipped=${skipped} skips=${JSON.stringify(skips)}`,
    );
  }
  return { inserted, skipped, skips: skips.length > 0 ? skips : undefined };
}
