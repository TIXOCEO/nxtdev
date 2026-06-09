import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { listTrainerDocuments } from "@/lib/db/trainer-documents";
import { NewDocumentForm } from "./_new-document-form";
import { DocumentRow } from "./_document-row";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  handleiding: "Handleiding",
  protocol: "Protocol",
  formulier: "Formulier",
  overig: "Overig",
};

export default async function TenantDocumentenPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const docs = await listTrainerDocuments(result.tenant.id, { includeArchived: true });

  return (
    <>
      <PageHeading title="Trainer-documenten" description="Handleidingen, protocollen en formulieren delen met trainers." />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--surface-card)" }}>
          {docs.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={FileText} title="Nog geen documenten" description="Voeg hieronder het eerste document toe." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider" style={{ borderColor: "var(--shell-border)", color: "var(--text-secondary)" }}>
                  <th className="px-4 py-2">Titel</th>
                  <th className="px-4 py-2">Categorie</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Acties</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <DocumentRow
                    key={d.id}
                    tenantId={result.tenant.id}
                    doc={d}
                    categoryLabel={CATEGORY_LABEL[d.category] ?? d.category}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <NewDocumentForm tenantId={result.tenant.id} />
      </div>
    </>
  );
}
