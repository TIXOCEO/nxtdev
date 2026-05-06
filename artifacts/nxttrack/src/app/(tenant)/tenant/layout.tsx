import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { TenantShell } from "@/components/tenant/tenant-shell";
import { TenantSelection } from "./_tenant-selection";
import { Toaster } from "@/components/ui/toaster";
import { getLatestPublishedRelease } from "@/lib/db/releases";

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

  const latestRelease = await getLatestPublishedRelease().catch(() => null);

  return (
    <TenantShell
      tenantName={result.tenant.name}
      primaryColor={result.tenant.primary_color}
      email={result.user.email ?? null}
      isPlatformAdmin={result.isPlatformAdmin}
      tenantSlug={result.tenant.slug}
      tenantDomain={result.tenant.domain}
      currentVersion={latestRelease?.version ?? null}
    >
      {children}
      <Toaster />
    </TenantShell>
  );
}
