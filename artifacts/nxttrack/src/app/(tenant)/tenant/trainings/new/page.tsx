import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getGroupsByTenant } from "@/lib/db/groups";
import { TrainingSessionForm } from "../_session-form";

export const dynamic = "force-dynamic";

export default async function NewTrainingPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const groups = await getGroupsByTenant(result.tenant.id);

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
          tenantId={result.tenant.id}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        />
      </div>
    </>
  );
}
