import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export interface SectorTemplateRow {
  key: string;
  name: string;
  description: string | null;
  terminology_json: Record<string, unknown>;
  default_modules_json: unknown[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SectorTemplateTenantUsage {
  id: string;
  name: string;
  slug: string | null;
}

/**
 * Groepeert alle tenants per `sector_template_key` zodat de
 * platform-admin sector-templates-pagina kan tonen welke tenants
 * impact ondervinden bij wijzigen of verwijderen. Tenants zonder
 * key (NULL) vallen buiten de map.
 */
export async function listTenantsBySectorTemplate(): Promise<
  Record<string, SectorTemplateTenantUsage[]>
> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug, sector_template_key")
    .not("sector_template_key", "is", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to fetch tenants by sector template: ${error.message}`);
  const out: Record<string, SectorTemplateTenantUsage[]> = {};
  for (const row of (data ?? []) as Array<{
    id: string;
    name: string;
    slug: string | null;
    sector_template_key: string | null;
  }>) {
    if (!row.sector_template_key) continue;
    (out[row.sector_template_key] ??= []).push({
      id: row.id,
      name: row.name,
      slug: row.slug,
    });
  }
  return out;
}

export async function listSectorTemplates(): Promise<SectorTemplateRow[]> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sector_templates")
    .select("*")
    .order("key", { ascending: true });
  if (error) throw new Error(`Failed to fetch sector templates: ${error.message}`);
  return (data ?? []) as SectorTemplateRow[];
}

/**
 * Onafhankelijk van platform-admin: voor de read-only preview op
 * `/tenant/profile` mogen tenant-admins alle templates inzien (RLS-policy
 * `sector_templates_authenticated_read` staat read voor authenticated toe).
 * Bewust géén `is_active`-filter zodat een tenant die nog gekoppeld is aan
 * een inmiddels inactief template gewoon de naam te zien krijgt i.p.v.
 * "geen sector".
 */
export async function listSectorTemplateNamesForRead(): Promise<
  { key: string; name: string; is_active: boolean }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sector_templates")
    .select("key, name, is_active")
    .order("name", { ascending: true });
  return (data ?? []) as { key: string; name: string; is_active: boolean }[];
}
