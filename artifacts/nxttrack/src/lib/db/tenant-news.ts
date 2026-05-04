import { createClient } from "@/lib/supabase/server";
import type { NewsCategory, NewsPost } from "@/types/database";

export interface NewsPostWithCategory extends NewsPost {
  category: Pick<NewsCategory, "id" | "name" | "slug"> | null;
}

function flattenCategory(
  rows: Array<NewsPost & { category: NewsCategory | NewsCategory[] | null }>,
): NewsPostWithCategory[] {
  return rows.map((r) => ({
    ...r,
    category: Array.isArray(r.category) ? (r.category[0] ?? null) : r.category,
  }));
}

export async function getTenantNewsPosts(
  tenantId: string,
): Promise<NewsPostWithCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*, category:news_categories(id,name,slug)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch news posts: ${error.message}`);
  return flattenCategory(
    (data ?? []) as unknown as Array<
      NewsPost & { category: NewsCategory | NewsCategory[] | null }
    >,
  );
}

export async function getTenantNewsPostById(
  id: string,
  tenantId: string,
): Promise<NewsPostWithCategory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*, category:news_categories(id,name,slug)")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as NewsPost & {
    category: NewsCategory | NewsCategory[] | null;
  };
  return {
    ...row,
    category: Array.isArray(row.category) ? (row.category[0] ?? null) : row.category,
  };
}

export async function getTenantNewsCategories(
  tenantId: string,
): Promise<NewsCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_categories")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
  return (data ?? []) as NewsCategory[];
}

export interface TenantNewsStats {
  total: number;
  published: number;
  drafts: number;
  archived: number;
}

export async function getTenantNewsStats(
  tenantId: string,
): Promise<TenantNewsStats> {
  const supabase = await createClient();
  const [total, published, drafts, archived] = await Promise.all([
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
      .from("news_posts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "archived"),
  ]);
  return {
    total: total.count ?? 0,
    published: published.count ?? 0,
    drafts: drafts.count ?? 0,
    archived: archived.count ?? 0,
  };
}
