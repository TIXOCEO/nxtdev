import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarPlus } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import { TryoutForm } from "@/components/public/forms/tryout-form";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  return { title: `${tenant.name} | Proefles` };
}

export default async function ProeflesPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Proefles" active="proefles">
      <PublicCard className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "color-mix(in srgb, var(--tenant-accent) 22%, transparent)",
              color: "var(--text-primary)",
            }}
          >
            <CalendarPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Schrijf je in voor een proefles!
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Doe vrijblijvend mee met een proeftraining bij {tenant.name}. Vul het
              formulier in en wij nemen zo snel mogelijk contact met je op om de
              proefles in te plannen.
            </p>
          </div>
        </div>
      </PublicCard>

      <TryoutForm tenantSlug={tenant.slug} />
    </PublicTenantShell>
  );
}
