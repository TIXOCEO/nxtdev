import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isTrainer } from "@/lib/auth/user-role-rules";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import { PageHeader } from "@/components/public/page-header";

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

/**
 * Sprint 78 — Trainer Documenten (read-only stub).
 * Toegang: alleen ingelogde trainers (zelfde regel als "Mijn groepen"-link).
 * Functionaliteit (upload/download/categoriseren) volgt in een follow-up task.
 */
export default async function DocumentenPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/documenten`);

  const ctx = await getUserTenantContext(tenant.id, user.id);
  if (!isTrainer(ctx)) {
    redirect(`/t/${slug}`);
  }

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Documenten" active="documenten">
      <PageHeader
        title="Documenten"
        description="Hier verschijnen binnenkort handleidingen, oefenmateriaal en trainersdocumenten."
      />
      <PublicCard className="p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: "var(--accent-tint)",
              color: "var(--brand-navy)",
            }}
          >
            <FolderOpen className="h-7 w-7" />
          </div>
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Nog geen documenten beschikbaar
          </h2>
          <p
            className="max-w-md text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            We werken aan een centrale plek waar je als trainer handleidingen,
            oefenstof en bestanden vindt die door de vereniging gedeeld zijn.
            Volgende sprint kunnen beheerders documenten uploaden en
            categoriseren.
          </p>
        </div>
      </PublicCard>
    </PublicTenantShell>
  );
}
