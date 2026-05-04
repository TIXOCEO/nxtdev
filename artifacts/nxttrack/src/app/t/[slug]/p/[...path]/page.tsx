import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import {
  buildPageTree,
  findPageByPath,
  listEnabledCustomPages,
} from "@/lib/db/custom-pages";
import { getUser } from "@/lib/auth/get-user";
import { getMemberships } from "@/lib/auth/get-memberships";
import { hasTenantAccess } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { composeMetadata } from "@/lib/seo/build-metadata";
import { getPageSeo, getTenantSeoSettings } from "@/lib/db/tenant-seo";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";

interface PageProps {
  params: Promise<{ slug: string; path: string[] }>;
}

export const dynamic = "force-dynamic";

async function resolve(slug: string, parts: string[]) {
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return null;
  const rows = await listEnabledCustomPages(tenant.id);
  const tree = buildPageTree(rows);
  const path = parts.join("/");
  const page = findPageByPath(tree, path);
  if (!page) return { tenant, page: null, path };
  return { tenant, page, path };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, path } = await params;
  const r = await resolve(slug, path);
  if (!r || !r.page) return { title: "NXTTRACK" };
  const [seo, override] = await Promise.all([
    getTenantSeoSettings(r.tenant.id),
    getPageSeo(r.tenant.id, `p/${r.path}`),
  ]);
  return composeMetadata(r.tenant, seo, override, {
    title: r.page.title,
  });
}

export default async function PublicCustomPage({ params }: PageProps) {
  const { slug, path } = await params;
  const r = await resolve(slug, path);
  if (!r) notFound();
  if (!r.page) notFound();
  if (r.page.requires_auth) {
    const user = await getUser();
    if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/p/${r.path}`);
    // Must be a member of THIS tenant (admin or member row), not just any logged-in user.
    const memberships = await getMemberships(user.id);
    let allowed = hasTenantAccess(memberships, r.tenant.id);
    if (!allowed) {
      const admin = createAdminClient();
      const { data: m } = await admin
        .from("members")
        .select("id")
        .eq("tenant_id", r.tenant.id)
        .eq("user_id", user.id)
        .limit(1);
      allowed = (m ?? []).length > 0;
    }
    if (!allowed) redirect(`/t/${slug}/login?next=/t/${slug}/p/${r.path}`);
  }

  return (
    <PublicTenantShell
      tenant={r.tenant}
      pageTitle={r.page.title}
      active="custom"
      customActivePath={r.path}
    >
      <article
        className="overflow-hidden rounded-[var(--radius-nxt-lg)] border p-5 sm:p-8"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
          boxShadow: "var(--shadow-app)",
        }}
      >
        <h1 className="mb-4 text-2xl font-bold sm:text-3xl" style={{ color: "var(--text-primary)" }}>
          {r.page.title}
        </h1>
        <div
          className="prose max-w-none text-sm leading-relaxed"
          style={{ color: "var(--text-primary)" }}
          dangerouslySetInnerHTML={{ __html: r.page.content_html || "" }}
        />
      </article>
    </PublicTenantShell>
  );
}
