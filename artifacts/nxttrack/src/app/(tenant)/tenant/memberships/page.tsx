import { CreditCard } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getPlansByTenant } from "@/lib/db/membership-plans";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { NewPlanForm } from "./_new-plan-form";
import { PlanToggle } from "./_plan-toggle";
import { PlanDefaultRadio } from "./_plan-default-radio";

export const dynamic = "force-dynamic";

const BILLING_LABELS: Record<string, string> = {
  monthly: "Per maand",
  quarterly: "Per kwartaal",
  yearly: "Per jaar",
  custom: "Custom",
};

function fmtPrice(p: number | null): string {
  if (p === null || Number.isNaN(p)) return "—";
  return `€ ${p.toFixed(2).replace(".", ",")}`;
}

export default async function TenantMembershipsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [plans, terminology] = await Promise.all([
    getPlansByTenant(result.tenant.id),
    getTenantTerminology(result.tenant.id),
  ]);

  return (
    <>
      <PageHeading
        title={terminology.program_plural}
        description={terminology.memberships_page_description}
      />

      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {terminology.memberships_new_form_title}
        </h2>
        <div className="mt-3">
          <NewPlanForm tenantId={result.tenant.id} />
        </div>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nog geen abonnementen"
          description="Maak je eerste abonnement aan via het formulier hierboven."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: "var(--surface-main)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.name}
                  </p>
                  <p
                    className="mt-0.5 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {fmtPrice(p.price)}{" "}
                    {p.billing_period
                      ? `· ${BILLING_LABELS[p.billing_period] ?? p.billing_period}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <PlanDefaultRadio
                    tenantId={result.tenant.id}
                    id={p.id}
                    isDefault={p.is_default}
                    disabled={!p.is_active}
                  />
                  <PlanToggle
                    tenantId={result.tenant.id}
                    id={p.id}
                    isActive={p.is_active}
                  />
                </div>
              </div>
              {p.is_default && (
                <p
                  className="mt-2 text-[11px] font-medium uppercase tracking-wide"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Wordt automatisch toegekend bij nieuwe leden.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
