import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { listAlertsAdmin } from "@/lib/db/homepage";
import { AlertsManager } from "@/components/tenant/alerts/alerts-manager";

export const dynamic = "force-dynamic";

export default async function TenantAlertsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const alerts = await listAlertsAdmin(result.tenant.id);

  return (
    <>
      <PageHeading
        title="Alerts & aankondigingen"
        description="Beheer actieve meldingen voor de homepage."
      />
      <AlertsManager tenantId={result.tenant.id} initial={alerts} />
    </>
  );
}
