import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sprint 72 — Seed default `program_stages` voor sector-specifieke
 * tenants. Wordt aangeroepen direct na tenant-creatie (na de
 * homepage-seed) zodat een nieuwe zwemschool meteen werkbare stages
 * heeft onder hun eerste programma.
 *
 * Idempotent: skipt wanneer er al stages bestaan voor het programma.
 * Faalt nooit hard — alle errors worden ge-logd maar niet ge-throw'd,
 * zodat de tenant-create-flow niet stuk gaat door een seed-probleem.
 */

interface StageSeed {
  name: string;
  description?: string;
  color?: string;
  sort_order: number;
}

const SWIMMING_STAGES: StageSeed[] = [
  { name: "Watergewenning", description: "Kennismaken met water, plezier en veiligheid.", color: "#60a5fa", sort_order: 10 },
  { name: "Drijven", description: "Zelfstandig drijven op rug en buik.", color: "#34d399", sort_order: 20 },
  { name: "Schoolslag basis", description: "Schoolslag-beenslag en -armslag onder begeleiding.", color: "#fbbf24", sort_order: 30 },
  { name: "Rugslag basis", description: "Rugslag-beenslag en -armslag onder begeleiding.", color: "#f97316", sort_order: 40 },
  { name: "Afzwem-ready", description: "Klaar voor afzwemmen — alle slagen op niveau.", color: "#ef4444", sort_order: 50 },
];

const SECTOR_STAGE_SEEDS: Record<string, StageSeed[]> = {
  swimming_school: SWIMMING_STAGES,
};

export interface SeedStagesResult {
  inserted: number;
  reason?: "no_seed" | "no_program" | "already_seeded" | "tenant_read_error" | "insert_error";
  error?: string;
}

export async function seedTenantProgramStagesFromSector(
  tenantId: string,
): Promise<SeedStagesResult> {
  const admin = createAdminClient();

  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("sector_template_key")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantErr) {
    // eslint-disable-next-line no-console
    console.error(`[sector-stages-seed] tenant read failed tenant=${tenantId}: ${tenantErr.message}`);
    return { inserted: 0, reason: "tenant_read_error", error: tenantErr.message };
  }
  const sectorKey =
    (tenant as { sector_template_key: string | null } | null)?.sector_template_key ?? null;
  if (!sectorKey) return { inserted: 0, reason: "no_seed" };

  const seeds = SECTOR_STAGE_SEEDS[sectorKey];
  if (!seeds || seeds.length === 0) return { inserted: 0, reason: "no_seed" };

  // Kies het eerste programma binnen de tenant — bij sector-template-
  // tenants is dat het sector-default programma. Als er geen programma
  // bestaat: skip (tenant heeft nog niets opgezet).
  const { data: programs, error: progErr } = await admin
    .from("programs")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (progErr) {
    // eslint-disable-next-line no-console
    console.error(`[sector-stages-seed] programs read failed tenant=${tenantId}: ${progErr.message}`);
    return { inserted: 0, reason: "tenant_read_error", error: progErr.message };
  }
  const programId = (programs?.[0] as { id: string } | undefined)?.id ?? null;
  if (!programId) return { inserted: 0, reason: "no_program" };

  const { count: existingCount } = await admin
    .from("program_stages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("program_id", programId);
  if ((existingCount ?? 0) > 0) {
    return { inserted: 0, reason: "already_seeded" };
  }

  const rows = seeds.map((s) => ({
    tenant_id: tenantId,
    program_id: programId,
    name: s.name,
    description: s.description ?? null,
    color: s.color ?? null,
    sort_order: s.sort_order,
  }));

  const { error: insertErr, count } = await admin
    .from("program_stages")
    .insert(rows, { count: "exact" });
  if (insertErr) {
    // eslint-disable-next-line no-console
    console.error(`[sector-stages-seed] insert failed tenant=${tenantId}: ${insertErr.message}`);
    return { inserted: 0, reason: "insert_error", error: insertErr.message };
  }

  // Schakel `use_stages` aan op dat programma.
  await admin
    .from("programs")
    .update({ use_stages: true })
    .eq("id", programId)
    .eq("tenant_id", tenantId);

  return { inserted: count ?? rows.length };
}
