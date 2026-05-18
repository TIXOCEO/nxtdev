import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getUserTenantContext, isParent, isAthlete } from "@/lib/auth/user-role-rules";
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
  return { title: `${tenant.name} | Betalingen` };
}

export default async function BetalingenPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/betalingen`);

  const ctx = await getUserTenantContext(tenant.id, user.id);
  if (!isParent(ctx) && !isAthlete(ctx)) redirect(`/t/${slug}`);

  // NB: Sprint 80 levert alleen de placeholder-pagina; integratie met een
  // payments/invoices-tabel volgt in een vervolgsprint. Toont voor nu een
  // duidelijke "in ontwikkeling"-staat zodat de route bestaat en de sidebar
  // niet leidt naar 404.
  return (
    <PublicTenantShell tenant={tenant} pageTitle="Betalingen" active="betalingen">
      <PageHeader
        title="Betalingen"
        description="Overzicht van openstaande en betaalde facturen."
      />
      <PublicCard className="p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "var(--accent-tint)", color: "var(--brand-navy)" }}
          >
            <CreditCard className="h-7 w-7" />
          </div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Betalingen-module komt binnenkort
          </h2>
          <p className="max-w-md text-sm" style={{ color: "var(--text-secondary)" }}>
            Op dit moment beheert de vereniging facturen buiten NXTTRACK. Zodra de betalingen-module
            actief is, vind je hier je openstaande en betaalde facturen.
          </p>
        </div>
      </PublicCard>
    </PublicTenantShell>
  );
}
