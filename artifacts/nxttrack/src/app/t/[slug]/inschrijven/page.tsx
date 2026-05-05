import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import { RegistrationWizard } from "@/components/public/forms/registration-wizard";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  return { title: `${tenant.name} | Inschrijven` };
}

export default async function InschrijvenPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Inschrijven" active="inschrijven">
      <PublicCard className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "color-mix(in srgb, var(--tenant-accent) 22%, transparent)",
              color: "var(--text-primary)",
            }}
          >
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Inschrijven
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Schrijf je in als aspirant-lid bij {tenant.name}. Na ontvangst van je
              aanmelding nemen wij contact op om de inschrijving verder af te ronden.
            </p>
          </div>
        </div>
      </PublicCard>

      <RegistrationWizard
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        accentColor={tenant.primary_color}
        allowStaffRegistration={
          (tenant.settings_json as Record<string, unknown> | null)?.[
            "public_staff_registration_enabled"
          ] === true
        }
      />
    </PublicTenantShell>
  );
}
