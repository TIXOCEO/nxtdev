import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getGroupsByTenant } from "@/lib/db/groups";
import { listProgramsPage } from "@/lib/db/programs";
import { listProgramMembershipPlans } from "@/lib/db/program-membership-plans";
import { TrainingSessionForm, type SessionFormProgram } from "../_session-form";

export const dynamic = "force-dynamic";

export default async function NewTrainingPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const tenantId = result.tenant.id;

  const [groups, programs] = await Promise.all([
    getGroupsByTenant(tenantId),
    listProgramsPage(tenantId),
  ]);

  const selectablePrograms = programs.filter((p) => p.visibility !== "archived");
  const programsWithPlans: SessionFormProgram[] = await Promise.all(
    selectablePrograms.map(async (p) => {
      const plans = await listProgramMembershipPlans(tenantId, p.id);
      return {
        id: p.id,
        name: p.name,
        plans: plans.map((pl) => ({
          name: pl.plan_name,
          price: pl.price,
          billing_period: pl.billing_period,
          is_default: pl.is_default,
        })),
      };
    }),
  );

  return (
    <>
      <Link
        href="/tenant/trainings"
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar trainingen
      </Link>

      <PageHeading
        title="Nieuwe training"
        description="Plan een training voor een groep. Aanwezigheidsrijen worden automatisch aangemaakt."
      />

      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <TrainingSessionForm
          tenantId={tenantId}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          programs={programsWithPlans}
        />
      </div>
    </>
  );
}
