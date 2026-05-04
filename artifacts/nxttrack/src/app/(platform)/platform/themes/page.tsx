import { PageHeading } from "@/components/ui/page-heading";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { listAllThemes } from "@/lib/db/themes";
import { getAllTenants } from "@/lib/db/platform-tenants";
import { ThemesManager } from "./_themes-manager";

export const dynamic = "force-dynamic";

export default async function PlatformThemesPage() {
  await requirePlatformAdmin();
  const [themes, tenants] = await Promise.all([listAllThemes(), getAllTenants()]);
  return (
    <>
      <PageHeading
        title="Themes"
        description="Beheer kleurenschema's. Een platform-thema is voor alle clubs beschikbaar; een tenant-thema alleen voor één club."
      />
      <ThemesManager
        themes={themes.map((t) => ({
          id: t.id,
          scope: t.scope,
          tenant_id: t.tenant_id,
          name: t.name,
          mode: t.mode,
          tokens: t.tokens,
          is_default: t.is_default,
        }))}
        tenants={tenants.map((t) => ({ id: t.id, name: t.name }))}
      />
    </>
  );
}
