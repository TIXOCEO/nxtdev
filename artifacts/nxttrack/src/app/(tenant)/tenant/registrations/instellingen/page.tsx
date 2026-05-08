import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntakeSettingsForm } from "./_form";

export const dynamic = "force-dynamic";

interface IntakeSettings {
  intake_default: "registration" | "waitlist";
  overrides: Record<string, "registration" | "waitlist">;
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
  const rawOverrides = s.intake_overrides_by_target;
  const overrides: Record<string, "registration" | "waitlist"> = {};
  if (rawOverrides && typeof rawOverrides === "object" && !Array.isArray(rawOverrides)) {
    for (const [k, v] of Object.entries(rawOverrides as Record<string, unknown>)) {
      if (v === "registration" || v === "waitlist") overrides[k] = v;
    }
  }
  return { intake_default: def, overrides };
}

export default async function IntakeSettingsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const settings = await readIntakeSettings(result.tenant.id);

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
        <IntakeSettingsForm tenantId={result.tenant.id} initial={settings} />
      </div>
    </>
  );
}
