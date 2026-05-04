import type { Metadata } from "next";
import type { Tenant } from "@/types/database";
import {
  getPageSeo,
  getTenantSeoSettings,
  type TenantSeoSettings,
} from "@/lib/db/tenant-seo";

export interface BuildMetadataInput {
  tenant: Tenant;
  /** The path AFTER /t/{slug}, e.g. "" for home, "nieuws", "p/contact". */
  pagePath: string;
  /** Per-call fallback (used when no override exists). */
  fallback?: {
    title?: string;
    description?: string;
    image?: string | null;
  };
}

function absolutizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) return url; // best-effort; relative still better than nothing
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

function applyTemplate(template: string, pageTitle: string, tenantName: string): string {
  return template.replace(/%s/g, pageTitle).replace(/%tenant%/g, tenantName);
}

/**
 * Build a unified `Metadata` for any tenant page. Order of preference:
 *   title       = page-override > fallback > tenant default > "{tenant}"
 *                 (then run through tenant.title_template if it uses %s)
 *   description = page-override > fallback > tenant default
 *   image       = page-override > fallback > tenant default
 */
export async function buildPageMetadata(
  input: BuildMetadataInput,
): Promise<Metadata> {
  const { tenant, pagePath, fallback } = input;
  const [seo, page] = await Promise.all([
    getTenantSeoSettings(tenant.id),
    getPageSeo(tenant.id, pagePath),
  ]);
  return composeMetadata(tenant, seo, page, fallback);
}

/**
 * Variant where the caller already has tenant_seo_settings cached (avoids a
 * second query). Used by news-post pages where we already know per-row SEO.
 */
export function composeMetadata(
  tenant: Tenant,
  seo: TenantSeoSettings | null,
  page: { title: string | null; description: string | null; image_url: string | null; noindex?: boolean } | null,
  fallback?: BuildMetadataInput["fallback"],
): Metadata {
  const tenantName = tenant.name;
  const rawTitle =
    page?.title ?? fallback?.title ?? seo?.default_title ?? tenantName;
  const description =
    page?.description ?? fallback?.description ?? seo?.default_description ?? undefined;
  const rawImage =
    page?.image_url ?? fallback?.image ?? seo?.default_image_url ?? undefined;
  const image = absolutizeUrl(rawImage);

  const template = seo?.title_template ?? "%s | %tenant%";
  const finalTitle = template.includes("%s")
    ? applyTemplate(template, rawTitle, tenantName)
    : rawTitle;

  const md: Metadata = {
    title: finalTitle,
    description,
    openGraph: {
      title: finalTitle,
      description,
      siteName: seo?.og_site_name ?? tenantName,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: finalTitle,
      description,
      images: image ? [image] : undefined,
      site: seo?.twitter_handle ?? undefined,
    },
  };
  if (page?.noindex) {
    md.robots = { index: false, follow: false };
  }
  return md;
}
