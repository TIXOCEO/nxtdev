import { createClient } from "@/lib/supabase/server";
import type { NewsPost } from "@/types/database";

export async function getPublishedNewsByTenant(tenantId: string): Promise<NewsPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch published news: ${error.message}`);
  }
  return (data ?? []) as NewsPost[];
}

export async function getNewsPostBySlug(
  tenantId: string,
  slug: string,
): Promise<NewsPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as NewsPost;
}
