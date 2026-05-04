import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantEmailSettings } from "@/lib/db/tenant-email-settings";
import { getEmailTriggersByTenant } from "@/lib/db/email-triggers";
import { getEmailTemplatesByTenant } from "@/lib/db/email-templates";
import { EmailSettingsForm } from "./_settings-form";
import { TriggerMatrix } from "./_trigger-matrix";

export const dynamic = "force-dynamic";

export default async function TenantEmailSettingsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [settings, triggers, templates] = await Promise.all([
    getTenantEmailSettings(result.tenant.id),
    getEmailTriggersByTenant(result.tenant.id),
    getEmailTemplatesByTenant(result.tenant.id),
  ]);

  return (
    <>
      <PageHeading
        title="E-mail instellingen"
        description="Beheer afzender, antwoordadres en regels voor uitnodigingen."
      />

      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <EmailSettingsForm
          tenantId={result.tenant.id}
          initial={settings}
        />
      </div>

      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          E-mail triggers
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Koppel platform-events aan templates. (Configuratie alleen — automatische
          verzending volgt in een latere sprint.)
        </p>
        <div className="mt-4">
          <TriggerMatrix
            tenantId={result.tenant.id}
            triggers={triggers}
            templates={templates.map((t) => ({ key: t.key, name: t.name }))}
          />
        </div>
      </div>
    </>
  );
}
