import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { FolderOpen, Download } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isTrainer } from "@/lib/auth/user-role-rules";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import { PageHeader } from "@/components/public/page-header";
import { listTrainerDocuments } from "@/lib/db/trainer-documents";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  return { title: `${tenant.name} | Documenten` };
}

const CATEGORY_LABEL: Record<string, string> = {
  handleiding: "Handleidingen",
  protocol: "Protocollen",
  formulier: "Formulieren",
  overig: "Overig",
};
const CATEGORY_ORDER = ["handleiding", "protocol", "formulier", "overig"] as const;

export default async function DocumentenPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/documenten`);

  const ctx = await getUserTenantContext(tenant.id, user.id);
  if (!isTrainer(ctx)) redirect(`/t/${slug}`);

  const docs = await listTrainerDocuments(tenant.id);
  const grouped = new Map<string, typeof docs>();
  for (const d of docs) {
    const list = grouped.get(d.category) ?? [];
    list.push(d);
    grouped.set(d.category, list);
  }

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Documenten" active="documenten">
      <PageHeader
        title="Documenten"
        description="Handleidingen, protocollen en formulieren gedeeld door de vereniging."
      />
      {docs.length === 0 ? (
        <PublicCard className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "var(--accent-tint)", color: "var(--brand-navy)" }}
            >
              <FolderOpen className="h-7 w-7" />
            </div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Nog geen documenten
            </h2>
            <p className="max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
              Beheerders kunnen documenten uploaden onder Tenant-instellingen → Documenten.
            </p>
          </div>
        </PublicCard>
      ) : (
        <div className="flex flex-col gap-4">
          {CATEGORY_ORDER.map((cat) => {
            const list = grouped.get(cat);
            if (!list || list.length === 0) return null;
            return (
              <div key={cat} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  {CATEGORY_LABEL[cat]}
                </h3>
                <PublicCard>
                  <div className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
                    {list.map((d) => (
                      <a
                        key={d.id}
                        href={d.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: "var(--accent-tint)", color: "var(--brand-navy)" }}
                        >
                          <Download className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {d.title}
                          </p>
                          {d.description && (
                            <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                              {d.description}
                            </p>
                          )}
                        </div>
                        {d.file_type && (
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                            {d.file_type}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                </PublicCard>
              </div>
            );
          })}
        </div>
      )}
    </PublicTenantShell>
  );
}
