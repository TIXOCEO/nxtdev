import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantPushSettings, getPlatformPushSettings } from "@/lib/db/push";
import { getNotificationEventsByTenant } from "@/lib/db/notifications";
import { TenantPushForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function TenantPushSettingsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [tenantSettings, platform, events] = await Promise.all([
    getTenantPushSettings(result.tenant.id),
    getPlatformPushSettings(),
    getNotificationEventsByTenant(result.tenant.id),
  ]);

  const platformAllowed = platform?.allowed_event_keys ?? [];
  const eventKeys = events
    .map((e) => e.event_key)
    .filter((k) => platformAllowed.length === 0 || platformAllowed.includes(k));

  return (
    <>
      <PageHeading
        title="Push-instellingen"
        description="Schakel pushmeldingen in voor jouw club en bepaal welke events er pushen."
      />
      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        {!platform?.vapid_public_key ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Push is nog niet geconfigureerd door de platform-beheerder.
          </p>
        ) : (
          <TenantPushForm
            tenantId={result.tenant.id}
            eventKeys={eventKeys}
            initial={{
              push_enabled: tenantSettings?.push_enabled ?? true,
              default_push_on_manual: tenantSettings?.default_push_on_manual ?? true,
              event_overrides: tenantSettings?.event_overrides ?? {},
            }}
          />
        )}
      </div>
    </>
  );
}
