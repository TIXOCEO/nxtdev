import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import {
  getActiveTenantBySlug,
  getPublicNewsCategories,
  getPublicNewsPosts,
} from "@/lib/db/public-tenant";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import { getTenantSeoSettings, getPageSeo } from "@/lib/db/tenant-seo";
import { composeMetadata } from "@/lib/seo/build-metadata";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  const [seo, override] = await Promise.all([
    getTenantSeoSettings(tenant.id),
    getPageSeo(tenant.id, "nieuws"),
  ]);
  return composeMetadata(tenant, seo, override, { title: "Nieuws" });
}

export default async function PublicNieuwsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const categories = await getPublicNewsCategories(tenant.id);
  const activeCategory = sp.category
    ? categories.find((c) => c.slug === sp.category) ?? null
    : null;

  const posts = await getPublicNewsPosts(tenant.id, {
    categoryId: activeCategory?.id ?? null,
  });

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Nieuws" active="nieuws">
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <CategoryPill
            label="Alles"
            href={`/t/${tenant.slug}/nieuws`}
            active={!activeCategory}
          />
          {categories.map((cat) => (
            <CategoryPill
              key={cat.id}
              label={cat.name}
              href={`/t/${tenant.slug}/nieuws?category=${cat.slug}`}
              active={activeCategory?.id === cat.id}
            />
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <PublicCard className="flex flex-col items-center gap-2 p-10 text-center">
          <Newspaper className="h-8 w-8" style={{ color: "var(--text-secondary)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Nog geen nieuws geplaatst
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {activeCategory
              ? "Er zijn nog geen berichten in deze categorie."
              : "Er zijn nog geen berichten om te tonen."}
          </p>
        </PublicCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const date = post.published_at ?? post.created_at;
            return (
              <Link
                key={post.id}
                href={`/t/${tenant.slug}/nieuws/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-[var(--radius-nxt-lg)] border transition-shadow hover:shadow-md"
                style={{
                  backgroundColor: "var(--surface-main)",
                  borderColor: "var(--surface-border)",
                  boxShadow: "var(--shadow-app)",
                }}
              >
                <div
                  className="aspect-[16/9] w-full overflow-hidden"
                  style={{ backgroundColor: "var(--surface-soft)" }}
                >
                  {post.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.cover_image_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    <span>{new Date(date).toLocaleDateString("nl-NL")}</span>
                    {post.category && <span>{post.category.name}</span>}
                  </div>
                  <h3 className="line-clamp-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="line-clamp-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {post.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PublicTenantShell>
  );
}

function CategoryPill({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
      style={{
        backgroundColor: active
          ? "color-mix(in srgb, var(--tenant-accent) 22%, transparent)"
          : "var(--surface-main)",
        borderColor: "var(--surface-border)",
        color: "var(--text-primary)",
      }}
    >
      {label}
    </Link>
  );
}
