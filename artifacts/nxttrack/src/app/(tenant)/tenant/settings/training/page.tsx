import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTrainingSettingsResolved } from "@/lib/db/training-settings";
import { TrainingSettingsForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function TrainingSettingsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const settings = await getTrainingSettingsResolved(result.tenant.id);

  return (
    <>
      <PageHeading
        title="Training-instellingen"
        description="Standaard herinnering, deadline voor late wijzigingen en trainer-meldingen."
      />
      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <TrainingSettingsForm tenantId={result.tenant.id} initial={settings} />
      </div>
    </>
  );
}
