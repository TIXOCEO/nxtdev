import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getPublicProgramBySlug } from "@/lib/db/programs-public";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import {
  RegistrationWizard,
  type RegistrationWizardProgramRef,
} from "@/components/public/forms/registration-wizard";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ program?: string; form?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  return { title: `${tenant.name} | Inschrijven` };
}

export default async function InschrijvenPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  // Sprint 66 — `/inschrijven?form=<slug>` is een alias voor de
  // dynamische intake-renderer op /proefles. Wanneer een form-slug
  // wordt meegegeven en de tenant dynamic-intake aan heeft staan,
  // sturen we de bezoeker door naar /proefles?form=<slug> (de
  // canonieke renderer-route, Sprint 65). Onbekende form-slugs of
  // tenants zonder dynamic intake → val terug op de gewone
  // RegistrationWizard.
  const formSlug =
    typeof sp.form === "string" ? sp.form.trim() : "";
  if (formSlug) {
    const { isDynamicIntakeEnabled } = await import("@/lib/intake/forms");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const settings =
      ((tenant as { settings_json?: Record<string, unknown> | null })
        .settings_json as Record<string, unknown> | null) ?? {};
    if (isDynamicIntakeEnabled(settings)) {
      const { data: row } = await createAdminClient()
        .from("intake_forms")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("slug", formSlug)
        .eq("status", "published")
        .maybeSingle();
      if (row?.id) {
        redirect(`/t/${tenant.slug}/proefles?form=${encodeURIComponent(formSlug)}`);
      }
    }
  }

  // Sprint 63 — Optionele ?program=<public_slug> deeplink. Als de slug
  // niet (meer) bestaat of niet publiek is, negeren we 'm stilletjes en
  // tonen we het normale formulier — geen 404 zodat oude links nooit
  // breken.
  let programRef: RegistrationWizardProgramRef | null = null;
  const programSlug = typeof sp.program === "string" ? sp.program.trim() : "";
  if (programSlug) {
    const prog = await getPublicProgramBySlug(tenant.id, programSlug);
    if (prog) {
      programRef = {
        id: prog.id,
        name: prog.name,
        marketingTitle: prog.marketing_title,
        ctaLabel: prog.cta_label,
      };
    }
  }

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
        program={programRef}
      />
    </PublicTenantShell>
  );
}
