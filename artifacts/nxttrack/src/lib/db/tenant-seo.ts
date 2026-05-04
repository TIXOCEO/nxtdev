import { createClient } from "@/lib/supabase/server";

export interface TenantSeoSettings {
  tenant_id: string;
  default_title: string | null;
  title_template: string | null;
  default_description: string | null;
  default_image_url: string | null;
  og_site_name: string | null;
  twitter_handle: string | null;
  updated_at: string;
}

export interface TenantPageSeo {
  id: string;
  tenant_id: string;
  page_path: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  noindex: boolean;
  updated_at: string;
}

export async function getTenantSeoSettings(
  tenantId: string,
): Promise<TenantSeoSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_seo_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as TenantSeoSettings | null) ?? null;
}

export async function getPageSeo(
  tenantId: string,
  pagePath: string,
): Promise<TenantPageSeo | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_page_seo")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("page_path", pagePath)
    .maybeSingle();
  return (data as TenantPageSeo | null) ?? null;
}

export async function listPageSeoForTenant(tenantId: string): Promise<TenantPageSeo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_page_seo")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("page_path", { ascending: true });
  return (data ?? []) as TenantPageSeo[];
}
