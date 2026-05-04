import { createClient } from "@/lib/supabase/server";
import type { NewsPost, Registration } from "@/types/database";

export interface TenantDashboardStats {
  newsTotal: number;
  newsPublished: number;
  newsDrafts: number;
  registrationsTotal: number;
  registrationsNew: number;
}

export async function getTenantDashboardStats(
  tenantId: string,
): Promise<TenantDashboardStats> {
  const supabase = await createClient();

  const [newsTotal, newsPub, newsDraft, regTotal, regNew] = await Promise.all([
    supabase
      .from("news_posts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("news_posts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "published"),
    supabase
      .from("news_posts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "draft"),
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "new"),
  ]);

  return {
    newsTotal: newsTotal.count ?? 0,
    newsPublished: newsPub.count ?? 0,
    newsDrafts: newsDraft.count ?? 0,
    registrationsTotal: regTotal.count ?? 0,
    registrationsNew: regNew.count ?? 0,
  };
}

export async function getTenantNewsOverview(
  tenantId: string,
  limit = 5,
): Promise<NewsPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch news overview: ${error.message}`);
  return (data ?? []) as NewsPost[];
}

export async function getTenantRegistrationsOverview(
  tenantId: string,
  limit = 5,
): Promise<Registration[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error)
    throw new Error(`Failed to fetch registrations overview: ${error.message}`);
  return (data ?? []) as Registration[];
}
