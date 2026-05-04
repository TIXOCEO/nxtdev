import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantSocialLink } from "@/types/database";

export async function listSocialLinksForTenant(
  tenantId: string,
): Promise<TenantSocialLink[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_social_links")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("platform", { ascending: true });
  return (data ?? []) as TenantSocialLink[];
}

export async function listActiveSocialLinks(
  tenantId: string,
): Promise<TenantSocialLink[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_social_links")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .neq("url", "")
    .order("sort_order", { ascending: true });
  return (data ?? []) as TenantSocialLink[];
}

export async function listSocialLinksAdmin(
  tenantId: string,
): Promise<TenantSocialLink[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant_social_links")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("platform", { ascending: true });
  return (data ?? []) as TenantSocialLink[];
}
