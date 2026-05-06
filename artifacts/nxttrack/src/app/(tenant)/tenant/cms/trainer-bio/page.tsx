import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import {
  ensureTrainerBioTemplate,
  listSectionsAdmin,
  listFieldsAdmin,
} from "@/lib/db/trainer-bio";
import { TrainerBioManager } from "@/components/tenant/trainer-bio/trainer-bio-manager";

export const dynamic = "force-dynamic";

export default async function TrainerBioCmsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;
  const tenantId = result.tenant.id;
  await requireTenantAdmin(tenantId);

  // Lazy seed defaults op eerste bezoek per tenant.
  await ensureTrainerBioTemplate(tenantId);

  const [sections, fields] = await Promise.all([
    listSectionsAdmin(tenantId),
    listFieldsAdmin(tenantId),
  ]);

  return (
    <>
      <PageHeading
        title="Trainersbio formulier"
        description="Beheer het formulier dat trainers in hun profiel invullen. Wijzigingen zijn direct zichtbaar."
      />
      <TrainerBioManager
        tenantId={tenantId}
        sections={sections}
        fields={fields}
      />
    </>
  );
}
