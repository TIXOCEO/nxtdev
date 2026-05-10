import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { NewProgramForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function NewProgramPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;
  const terminology = await getTenantTerminology(result.tenant.id);

  return (
    <>
      <Link
        href="/tenant/programmas"
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar {terminology.program_plural.toLowerCase()}
      </Link>

      <PageHeading
        title={terminology.programs_new_button}
        description={`Geef je ${terminology.program_singular.toLowerCase()} een naam, slug en standaard-capaciteit. Je kunt later groepen koppelen en marketing-velden invullen.`}
      />

      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <NewProgramForm tenantId={result.tenant.id} />
      </div>
    </>
  );
}
