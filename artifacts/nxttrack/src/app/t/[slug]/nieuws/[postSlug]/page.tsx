import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import {
  getActiveTenantBySlug,
  getPublicNewsPostBySlug,
} from "@/lib/db/public-tenant";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { getTenantSeoSettings } from "@/lib/db/tenant-seo";
import { composeMetadata } from "@/lib/seo/build-metadata";

interface PageProps {
  params: Promise<{ slug: string; postSlug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  const post = await getPublicNewsPostBySlug(tenant.id, postSlug);
  if (!post) return { title: `${tenant.name} | Nieuws` };
  const seo = await getTenantSeoSettings(tenant.id);
  // Per-post SEO automation: prefer post.seo_* (Sprint 15) → fall back to
  // excerpt/cover → tenant logo → site-wide /opengraph.jpg, so social shares
  // (Facebook, LinkedIn, WhatsApp) always get an image even when the post
  // has no cover and the tenant left default_image_url empty.
  const imageFallback =
    post.seo_image_url ??
    post.cover_image_url ??
    seo?.default_image_url ??
    tenant.logo_url ??
    "/opengraph.jpg";
  return composeMetadata(
    tenant,
    seo,
    {
      title: post.seo_title ?? null,
      description: post.seo_description ?? post.excerpt ?? null,
      image_url: imageFallback,
      noindex: post.seo_noindex ?? false,
    },
    { title: post.title },
  );
}

export default async function PublicNieuwsPostPage({ params }: PageProps) {
  const { slug, postSlug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();
  const post = await getPublicNewsPostBySlug(tenant.id, postSlug);
  if (!post) notFound();

  const date = post.published_at ?? post.created_at;

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Nieuws" active="nieuws">
      <Link
        href={`/t/${tenant.slug}/nieuws`}
        className="inline-flex items-center gap-1 text-xs hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Alle nieuws
      </Link>

      <article
        className="overflow-hidden rounded-[var(--radius-nxt-lg)] border"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
          boxShadow: "var(--shadow-app)",
        }}
      >
        {post.cover_image_url && (
          <div className="aspect-[16/8] w-full overflow-hidden" style={{ backgroundColor: "var(--surface-soft)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="space-y-4 p-5 sm:p-8">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              <span>{new Date(date).toLocaleDateString("nl-NL")}</span>
              {post.category && (
                <>
                  <span>·</span>
                  <span>{post.category.name}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: "var(--text-primary)" }}>
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {post.excerpt}
              </p>
            )}
          </div>

          {post.content_html && (
            <div
              className="prose prose-sm max-w-none sm:prose-base prose-headings:text-[color:var(--text-primary)] prose-p:text-[color:var(--text-primary)] prose-a:text-[color:var(--tenant-accent)]"
              dangerouslySetInnerHTML={{ __html: post.content_html }}
            />
          )}
        </div>
      </article>
    </PublicTenantShell>
  );
}
