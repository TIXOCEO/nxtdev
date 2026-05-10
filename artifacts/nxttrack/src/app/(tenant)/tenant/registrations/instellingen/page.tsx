import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntakeSettingsForm } from "./_form";

export const dynamic = "force-dynamic";

interface IntakeSettings {
  intake_default: "registration" | "waitlist";
  overrides: Record<string, "registration" | "waitlist">;
  /** Sprint 64 — Sleutel = `programs.public_slug`. */
  programOverrides: Record<string, "registration" | "waitlist">;
}

interface PublicProgramOption {
  public_slug: string;
  name: string;
  marketing_title: string | null;
}

async function readIntakeSettings(tenantId: string): Promise<IntakeSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("settings_json")
    .eq("id", tenantId)
    .maybeSingle();
  const s = (data?.settings_json ?? {}) as Record<string, unknown>;
  const def = s.intake_default === "waitlist" ? "waitlist" : "registration";

  const rawTargets = s.intake_overrides_by_target;
  const overrides: Record<string, "registration" | "waitlist"> = {};
  if (rawTargets && typeof rawTargets === "object" && !Array.isArray(rawTargets)) {
    for (const [k, v] of Object.entries(rawTargets as Record<string, unknown>)) {
      if (v === "registration" || v === "waitlist") overrides[k] = v;
    }
  }

  const rawPrograms = s.intake_overrides_by_program;
  const programOverrides: Record<string, "registration" | "waitlist"> = {};
  if (rawPrograms && typeof rawPrograms === "object" && !Array.isArray(rawPrograms)) {
    for (const [k, v] of Object.entries(rawPrograms as Record<string, unknown>)) {
      if (v === "registration" || v === "waitlist") programOverrides[k] = v;
    }
  }

  return { intake_default: def, overrides, programOverrides };
}

/**
 * Sprint 64 — Alleen publieke programs (visibility='public' + public_slug not null)
 * zijn relevant voor de override-cascade, want alleen die programma's komen
 * via een `?program=<public_slug>`-deeplink in de publieke wizard binnen.
 * Internal/archived programma's worden uitgesloten zodat het paneel niet
 * vervuilt met dead-weight rijen.
 */
async function listPublicProgramOptions(
  tenantId: string,
): Promise<PublicProgramOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("programs")
    .select("public_slug, name, marketing_title")
    .eq("tenant_id", tenantId)
    .eq("visibility", "public")
    .not("public_slug", "is", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []).map((r) => ({
    public_slug: r.public_slug as string,
    name: r.name as string,
    marketing_title: (r.marketing_title as string | null) ?? null,
  }));
}

export default async function IntakeSettingsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [settings, programs] = await Promise.all([
    readIntakeSettings(result.tenant.id),
    listPublicProgramOptions(result.tenant.id),
  ]);

  return (
    <>
      <PageHeading
        title="Aanmeld-routing"
        description="Bepaal waar nieuwe aanmeldingen via het publieke formulier landen — als gewone inschrijving of direct op de wachtlijst. Het bestaande formulier blijft onveranderd."
      />
      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <IntakeSettingsForm
          tenantId={result.tenant.id}
          initial={settings}
          programs={programs}
        />
      </div>
    </>
  );
}
