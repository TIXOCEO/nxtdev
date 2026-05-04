import { redirect } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { requireAuth } from "@/lib/auth/require-auth";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import {
  listAllThemes,
  listTenantActiveThemes,
} from "@/lib/db/themes";
import { TenantThemesForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function TenantThemesPage() {
  await requireAuth();
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/");
  await requireTenantAdmin(tenantId);

  const [allThemes, activations] = await Promise.all([
    listAllThemes(),
    listTenantActiveThemes(tenantId),
  ]);

  // Available to this tenant: all platform themes + own tenant themes.
  const available = allThemes.filter(
    (t) => t.scope === "platform" || (t.scope === "tenant" && t.tenant_id === tenantId),
  );

  const activationMap = new Map<string, boolean>();
  for (const a of activations) activationMap.set(a.theme_id, a.enabled);

  return (
    <>
      <PageHeading
        title="Thema's"
        description="Bepaal welke thema's beschikbaar zijn voor jouw leden. Platform-thema's staan standaard aan; je kunt ze hier uitzetten."
      />
      <TenantThemesForm
        tenantId={tenantId}
        themes={available.map((t) => ({
          id: t.id,
          scope: t.scope,
          name: t.name,
          mode: t.mode,
          tokens: t.tokens,
          is_default: t.is_default,
          enabled: activationMap.get(t.id) !== false, // default true
        }))}
      />
    </>
  );
}
