import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getSocialSettings } from "@/lib/db/social";
import { SocialSettingsForm } from "@/components/tenant/social/social-settings-form";

export const dynamic = "force-dynamic";

export default async function TenantSocialFeedSettingsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const settings = await getSocialSettings(result.tenant.id);

  return (
    <>
      <PageHeading
        title="Social feed"
        description="Bepaal welke onderdelen van de community-feed actief zijn voor jouw club."
      />
      <SocialSettingsForm tenantId={result.tenant.id} initial={settings} />
    </>
  );
}
