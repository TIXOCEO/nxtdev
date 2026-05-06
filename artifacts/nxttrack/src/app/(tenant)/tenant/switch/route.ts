import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import { hasTenantAccess } from "@/lib/permissions";
import { ACTIVE_TENANT_COOKIE } from "@/lib/auth/active-tenant-cookie";

export const dynamic = "force-dynamic";

/**
 * GET-route die de actieve-tenant cookie zet vanuit een query parameter en
 * doorstuurt naar de admin-shell. Gebruikt door de "Admin"-knop in de
 * publieke tenant-header. Moet een Route Handler zijn (geen page) omdat
 * Next.js 15 cookies().set() uit een Server Component render-pad blokkeert.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tenantId = (url.searchParams.get("tenant") ?? "").trim();
  const nextParam = url.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/tenant";

  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
    redirect("/tenant");
  }

  const user = await requireAuth();
  const [memberships, adminRoleTenantIds] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);
  if (!hasTenantAccess(memberships, tenantId, adminRoleTenantIds)) {
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
