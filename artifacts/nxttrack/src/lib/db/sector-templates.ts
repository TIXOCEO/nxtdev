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
