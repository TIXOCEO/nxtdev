import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { listSectorTemplateNamesForRead } from "@/lib/db/sector-templates";
import { safeParseTerminology } from "@/lib/terminology/schema";
import type { TerminologyKey } from "@/lib/terminology/types";
import { ProfileForm } from "./_profile-form";
import { SectorPreview } from "./_sector-preview";

export const dynamic = "force-dynamic";

export default async function TenantProfilePage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [terminology, templates] = await Promise.all([
    getTenantTerminology(result.tenant.id),
    listSectorTemplateNamesForRead(),
  ]);
  const sectorKey = result.tenant.sector_template_key;
  const matched = templates.find((t) => t.key === sectorKey) ?? null;
  const templateName = matched
    ? matched.is_active
      ? matched.name
      : `${matched.name} (inactief)`
    : null;
  const overrideKeys = Object.keys(
    safeParseTerminology(
      ((result.tenant.settings_json ?? {}) as Record<string, unknown>).terminology_overrides,
    ),
  ) as TerminologyKey[];

  return (
    <>
      <PageHeading
        title="Tenant profile"
        description="Update your tenant's branding and contact details."
      />
      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <ProfileForm tenant={result.tenant} />
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Need to change the slug or status? That's a platform-level action — ask a platform admin.
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Sector & woordenschat
        </h2>
        <SectorPreview
          templateName={templateName}
          templateKey={sectorKey}
          terminology={terminology}
          overrideKeys={overrideKeys}
        />
      </section>
    </>
  );
}
