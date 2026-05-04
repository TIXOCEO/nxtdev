import { createClient } from "@/lib/supabase/server";
import type {
  Tenant,
  NewsPost,
  NewsCategory,
} from "@/types/database";

export interface PublicNewsPost
  extends Pick<
    NewsPost,
    | "id"
    | "tenant_id"
    | "title"
    | "slug"
    | "excerpt"
    | "content_html"
    | "cover_image_url"
    | "category_id"
    | "status"
    | "published_at"
    | "created_at"
  > {
  category: Pick<NewsCategory, "id" | "name" | "slug"> | null;
}

function flattenCategory(
  rows: Array<PublicNewsPost & { category: NewsCategory | NewsCategory[] | null }>,
): PublicNewsPost[] {
  return rows.map((r) => ({
    ...r,
    category: Array.isArray(r.category) ? (r.category[0] ?? null) : r.category,
  }));
}

/**
 * Fetch a tenant by slug, **only if active**. Returns null otherwise.
 * Defense in depth: RLS already restricts public reads to active tenants,
 * but we also filter explicitly so a logged-in admin doesn't accidentally
 * see an inactive tenant on the public site via their own RLS bypass.
 */
export async function getActiveTenantBySlug(slug: string): Promise<Tenant | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return data as Tenant;
}

const PUBLIC_NEWS_FIELDS =
  "id, tenant_id, title, slug, excerpt, content_html, cover_image_url, category_id, status, published_at, created_at";

/**
 * Latest published news posts for a tenant. Optionally limit.
 * Defense in depth: an inner join on `tenants` requires `tenants.status='active'`,
 * so even if this is called with an inactive tenant id by an authenticated role
 * with broader RLS, no rows are returned.
 */
export async function getPublicNewsPosts(
  tenantId: string,
  options: { limit?: number; categoryId?: string | null } = {},
): Promise<PublicNewsPost[]> {
  const supabase = await createClient();
  let query = supabase
    .from("news_posts")
    .select(
      `${PUBLIC_NEWS_FIELDS}, category:news_categories(id,name,slug), tenant:tenants!inner(status)`,
    )
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .eq("tenant.status", "active")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch news posts: ${error.message}`);
  return flattenCategory(
    (data ?? []) as unknown as Array<
      PublicNewsPost & { category: NewsCategory | NewsCategory[] | null }
    >,
  );
}

/** Single published post for a tenant by post slug. */
export async function getPublicNewsPostBySlug(
  tenantId: string,
  postSlug: string,
): Promise<PublicNewsPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_posts")
    .select(
      `${PUBLIC_NEWS_FIELDS}, category:news_categories(id,name,slug), tenant:tenants!inner(status)`,
    )
    .eq("tenant_id", tenantId)
    .eq("slug", postSlug)
    .eq("status", "published")
    .eq("tenant.status", "active")
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as PublicNewsPost & {
    category: NewsCategory | NewsCategory[] | null;
  };
  return {
    ...row,
    category: Array.isArray(row.category) ? (row.category[0] ?? null) : row.category,
  };
}

/**
 * All categories for a tenant (used by news overview filter).
 * Inner-join on `tenants` ensures only active-tenant categories are returned.
 */
export async function getPublicNewsCategories(tenantId: string): Promise<NewsCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_categories")
    .select("*, tenant:tenants!inner(status)")
    .eq("tenant_id", tenantId)
    .eq("tenant.status", "active")
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
  return (data ?? []).map(({ tenant: _t, ...rest }) => rest as NewsCategory);
}

export interface PublicTenantHomeData {
  tenant: Tenant;
  latestNews: PublicNewsPost[];
}

/** Combined home-page payload. Returns null if tenant is missing/inactive. */
export async function getPublicTenantHomeData(
  slug: string,
): Promise<PublicTenantHomeData | null> {
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return null;
  const latestNews = await getPublicNewsPosts(tenant.id, { limit: 3 });
  return { tenant, latestNews };
}
