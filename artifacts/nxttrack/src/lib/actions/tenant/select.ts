"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import { hasTenantAccess } from "@/lib/permissions";
import { ACTIVE_TENANT_COOKIE } from "@/lib/auth/active-tenant-cookie";

/**
 * Set the active tenant cookie. Used by the platform-admin selection screen.
 * Can be invoked as a `<form action={selectActiveTenant}>` handler.
 */
export async function selectActiveTenant(formData: FormData): Promise<void> {
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
    throw new Error("Invalid tenant id");
  }

  const user = await requireAuth();
  const [memberships, adminRoleTenantIds] = await Promise.all([
    getMemberships(user.id),
    getAdminRoleTenantIds(user.id),
  ]);
  if (!hasTenantAccess(memberships, tenantId, adminRoleTenantIds)) {
    throw new Error("Forbidden: no access to this tenant.");
  }

  const c = await cookies();
  c.set(ACTIVE_TENANT_COOKIE, tenantId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/tenant");
}

export async function clearActiveTenant(): Promise<void> {
  const c = await cookies();
  c.delete(ACTIVE_TENANT_COOKIE);
  redirect("/tenant");
}
