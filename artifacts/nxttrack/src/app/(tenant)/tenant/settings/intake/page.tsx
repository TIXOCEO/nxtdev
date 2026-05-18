import { redirect } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import { hasTenantAccess } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntakeSettingsToggle } from "./_toggle";

export const dynamic = "force-dynamic";

export default async function IntakeSettingsPage() {
  const user = await requireAuth();
  const memberships = await getMemberships(user.id);
  const adminTenantIds = await getAdminRoleTenantIds(user.id);
  const activeCookie = await readActiveTenantCookie();
  const tenantId = activeCookie ?? memberships[0]?.tenant_id ?? null;
  if (!tenantId) redirect("/login");
  const allowed = hasTenantAccess(memberships, tenantId, adminTenantIds);
  if (!allowed) redirect("/login");

  const admin = createAdminClient();
  const { data: tenantRow } = await admin
    .from("tenants")
    .select("id, name, settings_json")
    .eq("id", tenantId)
    .maybeSingle();
  const settings =
    ((tenantRow?.settings_json as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const enabled = settings.public_intake_propose_slots === true;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <PageHeading
        title="Intake — publieke voorstellen"
        description="Bepaal of aanvragers na het indienen van het formulier direct 3 tijdsblok-voorstellen te zien krijgen."
      />
      <div
        className="mt-6 rounded-2xl p-5"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <IntakeSettingsToggle
          tenantId={tenantId}
          initialEnabled={enabled}
        />
        <div className="mt-4 space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>Aan:</strong> aanvrager ziet direct 3 voorstellen met wachttijd per groep, met expliciete wachtlijst-keuze bij geen capaciteit.
          </p>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>Uit (standaard):</strong> de aanvraag wordt automatisch op de wachtlijst gezet bij geen capaciteit en de aanvrager krijgt alleen een bevestigingsmail.
          </p>
        </div>
      </div>
    </main>
  );
}
