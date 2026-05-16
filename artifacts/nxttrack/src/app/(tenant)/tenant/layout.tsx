import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { TenantShell } from "@/components/tenant/tenant-shell";
import { TenantSelection } from "./_tenant-selection";
import { Toaster } from "@/components/ui/toaster";
import { getLatestPublishedRelease, hasUserSeenRelease } from "@/lib/db/releases";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { TerminologyProvider } from "@/lib/terminology/provider";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const [latestRelease, terminology, tenantSettings] = await Promise.all([
    getLatestPublishedRelease().catch(() => null),
    getTenantTerminology(result.tenant.id),
    // Sprint 65 — lees settings_json voor dynamic_intake_enabled flag.
    (async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("tenants")
        .select("settings_json")
        .eq("id", result.tenant.id)
        .maybeSingle();
      return (data?.settings_json ?? {}) as Record<string, unknown>;
    })().catch(() => ({}) as Record<string, unknown>),
  ]);
  const dynamicIntakeEnabled = tenantSettings.dynamic_intake_enabled === true;
  const latestVersionUnseen = latestRelease
    ? !(await hasUserSeenRelease(result.user.id, latestRelease.version).catch(() => true))
    : false;

  return (
    <TerminologyProvider value={terminology}>
      <TenantShell
        tenantName={result.tenant.name}
        primaryColor={result.tenant.primary_color}
        email={result.user.email ?? null}
        isPlatformAdmin={result.isPlatformAdmin}
        tenantSlug={result.tenant.slug}
        tenantDomain={result.tenant.domain}
        currentVersion={latestRelease?.version ?? null}
        currentVersionUnseen={latestVersionUnseen}
        showIntake={dynamicIntakeEnabled}
      >
        {children}
        <Toaster />
      </TenantShell>
    </TerminologyProvider>
  );
}
