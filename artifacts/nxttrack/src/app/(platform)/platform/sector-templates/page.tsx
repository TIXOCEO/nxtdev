import { PageHeading } from "@/components/ui/page-heading";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import {
  listSectorTemplates,
  listTenantsBySectorTemplate,
} from "@/lib/db/sector-templates";
import { SectorTemplatesManager } from "./_manager";

export const dynamic = "force-dynamic";

export default async function PlatformSectorTemplatesPage() {
  await requirePlatformAdmin();
  const [templates, tenantsByKey] = await Promise.all([
    listSectorTemplates(),
    listTenantsBySectorTemplate(),
  ]);
  return (
    <>
      <PageHeading
        title="Sectortemplates"
        description="Beheer sector-specifieke woordenschat en standaardmodules. Tenants erven hun terminologie van een gekozen template; eigen overrides leven per tenant."
      />
      <SectorTemplatesManager
        templates={templates.map((t) => ({
          key: t.key,
          name: t.name,
          description: t.description,
          terminology_json: (t.terminology_json ?? {}) as Record<string, string>,
          default_modules_json: t.default_modules_json ?? [],
          is_active: t.is_active,
          tenants: tenantsByKey[t.key] ?? [],
        }))}
      />
    </>
  );
}
