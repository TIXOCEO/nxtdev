import { createClient } from "@/lib/supabase/server";

/**
 * Sprint 63 — Publieke marketplace-helpers voor programma's.
 *
 * Beide queries scopen ALTIJD expliciet op tenant_id (defense-in-depth
 * naast de RLS-policy `programs_public_read`) en filteren op
 * visibility='public' + public_slug not null.
 */

export interface PublicProgramRow {
  id: string;
  tenant_id: string;
  public_slug: string;
  name: string;
  marketing_title: string | null;
  marketing_description: string | null;
  hero_image_url: string | null;
  cta_label: string | null;
  age_min: number | null;
  age_max: number | null;
  highlights_json: string[];
  sort_order: number;
}

const PUBLIC_PROGRAM_COLUMNS =
  "id, tenant_id, public_slug, name, marketing_title, marketing_description, hero_image_url, cta_label, age_min, age_max, highlights_json, sort_order";

function normalize(row: Record<string, unknown>): PublicProgramRow {
  const raw = row.highlights_json;
  const highlights: string[] = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    public_slug: row.public_slug as string,
    name: row.name as string,
    marketing_title: (row.marketing_title as string | null) ?? null,
    marketing_description: (row.marketing_description as string | null) ?? null,
    hero_image_url: (row.hero_image_url as string | null) ?? null,
    cta_label: (row.cta_label as string | null) ?? null,
    age_min: (row.age_min as number | null) ?? null,
    age_max: (row.age_max as number | null) ?? null,
    highlights_json: highlights,
    sort_order: (row.sort_order as number) ?? 0,
  };
}

/** Lijst publieke programma's voor een tenant, gesorteerd op sort_order, naam. */
export async function listPublicMarketplacePrograms(
  tenantId: string,
): Promise<PublicProgramRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select(PUBLIC_PROGRAM_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("visibility", "public")
    .not("public_slug", "is", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`listPublicMarketplacePrograms: ${error.message}`);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

/** Goedkope count voor sidebar-conditional. */
export async function countPublicMarketplacePrograms(
  tenantId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("programs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("visibility", "public")
    .not("public_slug", "is", null);
  if (error) return 0;
  return count ?? 0;
}

/** Detail-lookup per (tenant, public_slug). */
export async function getPublicProgramBySlug(
  tenantId: string,
  publicSlug: string,
): Promise<PublicProgramRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select(PUBLIC_PROGRAM_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("visibility", "public")
    .eq("public_slug", publicSlug)
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data as Record<string, unknown>);
}
