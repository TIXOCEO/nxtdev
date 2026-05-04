import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import {
  getAvailableTemplates,
  getTenantPictureSettings,
  getTenantTemplates,
} from "@/lib/db/profile-pictures";
import { ProfilePicturesManager } from "./_manager";

export const dynamic = "force-dynamic";

export default async function TenantProfilePicturesPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [tenantTemplates, allAvailable, settings] = await Promise.all([
    getTenantTemplates(result.tenant.id),
    getAvailableTemplates(result.tenant.id),
    getTenantPictureSettings(result.tenant.id),
  ]);

  return (
    <>
      <PageHeading
        title="Profielafbeeldingen"
        description="Beheer eigen templates en kies de standaard voor jouw club."
      />
      <ProfilePicturesManager
        tenantId={result.tenant.id}
        tenantTemplates={tenantTemplates}
        availableTemplates={allAvailable}
        defaultTemplateId={settings?.default_template_id ?? null}
        allowMemberChoose={settings?.allow_member_choose ?? true}
      />
    </>
  );
}
