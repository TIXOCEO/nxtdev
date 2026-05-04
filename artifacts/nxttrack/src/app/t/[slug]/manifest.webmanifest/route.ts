import { NextResponse } from "next/server";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Sprint 13 — per-tenant PWA manifest. Branded with the tenant's name,
 * colors, and (eventually) icon. Served as application/manifest+json
 * so the browser treats this exactly like a static .webmanifest file.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return new NextResponse("Not found", { status: 404 });

  const themeColor = /^#[0-9a-fA-F]{6}$/.test(tenant.primary_color)
    ? tenant.primary_color
    : "#b6d83b";

  const icon = tenant.logo_url
    ? { src: tenant.logo_url, sizes: "any", type: "image/png", purpose: "any" }
    : { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" };

  const manifest = {
    name: tenant.name,
    short_name: tenant.name,
    description: `NXTTRACK — ${tenant.name}`,
    start_url: `/t/${slug}`,
    scope: `/t/${slug}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8faf2",
    theme_color: themeColor,
    icons: [icon, { ...icon, purpose: "maskable" }],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
