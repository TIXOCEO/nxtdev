import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getUserPermissionsInTenant } from "@/lib/db/tenant-roles";
import { getAllPaymentMethods } from "@/lib/db/payment-methods";
import { PaymentMethodsManager } from "./_manager";

export const dynamic = "force-dynamic";

export default async function PaymentMethodsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  // Sprint F — gate: platform_admin / tenant_admin (enum) of expliciete
  // permissie `settings.payment_methods.manage`.
  const isTenantAdminEnum = result.membership?.role === "tenant_admin";
  if (!result.isPlatformAdmin && !isTenantAdminEnum) {
    const perms = await getUserPermissionsInTenant(result.tenant.id, result.user.id);
    if (!perms.includes("settings.payment_methods.manage")) {
      redirect("/tenant/settings");
    }
  }

  const methods = await getAllPaymentMethods(result.tenant.id);

  return (
    <>
      <PageHeading
        title="Betaalmogelijkheden"
        description="Beheer welke betaalmethoden leden kunnen kiezen voor contributie en lidmaatschap."
      />
      <div
        className="rounded-2xl border p-2 sm:p-4"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <PaymentMethodsManager tenantId={result.tenant.id} initial={methods} />
      </div>
      <p className="mt-3 inline-flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <CreditCard className="mt-0.5 h-3.5 w-3.5" />
        Methodes met type 'rekening' tonen het IBAN dat leden moeten gebruiken
        voor handmatige overschrijving. Archiveren verbergt de methode op het
        ledenprofiel; bestaande koppelingen blijven intact.
      </p>
    </>
  );
}
