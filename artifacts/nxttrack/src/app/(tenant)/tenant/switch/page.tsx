import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMemberships } from "@/lib/auth/get-memberships";
import { hasTenantAccess } from "@/lib/permissions";
import { ACTIVE_TENANT_COOKIE } from "@/lib/auth/active-tenant-cookie";

interface PageProps {
  searchParams: Promise<{ tenant?: string; next?: string }>;
}

export const dynamic = "force-dynamic";

/**
 * GET-route die de actieve-tenant cookie zet vanuit een query parameter
 * en doorstuurt naar de admin-shell. Wordt gebruikt door de "Admin"-knop
 * in de publieke tenant-header zodat een platform admin direct in de
 * juiste tenant-context landt zonder eerst een selectie-scherm te zien.
 */
export default async function TenantSwitchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = (params.tenant ?? "").trim();
  const next = params.next && params.next.startsWith("/") ? params.next : "/tenant";

  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
    redirect("/tenant");
  }

  const user = await requireAuth();
  const memberships = await getMemberships(user.id);
  if (!hasTenantAccess(memberships, tenantId)) {
    redirect("/");
  }

  const c = await cookies();
  c.set(ACTIVE_TENANT_COOKIE, tenantId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next);
}
