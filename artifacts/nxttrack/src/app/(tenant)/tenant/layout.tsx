import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { TenantShell } from "@/components/tenant/tenant-shell";
import { TenantSelection } from "./_tenant-selection";

export const dynamic = "force-dynamic";

export default async function TenantAdminLayout({ children }: { children: ReactNode }) {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);

  if (result.kind === "no_access") {
    redirect("/");
  }

  if (result.kind === "needs_selection") {
    return <TenantSelection tenants={result.tenants} />;
  }

  return (
    <TenantShell
      tenantName={result.tenant.name}
      primaryColor={result.tenant.primary_color}
      email={result.user.email ?? null}
      isPlatformAdmin={result.isPlatformAdmin}
    >
      {children}
    </TenantShell>
  );
}
