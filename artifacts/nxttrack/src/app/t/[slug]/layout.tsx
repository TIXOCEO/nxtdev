import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getTenantSeoSettings, getPageSeo } from "@/lib/db/tenant-seo";
import { composeMetadata } from "@/lib/seo/build-metadata";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  const [seo, override] = await Promise.all([
    getTenantSeoSettings(tenant.id),
    getPageSeo(tenant.id, ""),
  ]);
  const meta = composeMetadata(tenant, seo, override, { title: tenant.name });
  return {
    ...meta,
    manifest: `/t/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: tenant.name, statusBarStyle: "default" },
  };
}

export async function generateViewport({ params }: LayoutProps): Promise<Viewport> {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  const themeColor =
    tenant && /^#[0-9a-fA-F]{6}$/.test(tenant.primary_color)
      ? tenant.primary_color
      : "#b6d83b";
  return { themeColor };
}

export default async function TenantPublicLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();
  return <>{children}</>;
}
