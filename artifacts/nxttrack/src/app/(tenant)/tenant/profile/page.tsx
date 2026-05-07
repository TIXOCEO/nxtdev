import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { listSectorTemplateNamesForRead } from "@/lib/db/sector-templates";
import { safeParseTerminology } from "@/lib/terminology/schema";
import { resolveTerminology } from "@/lib/terminology/merge";
import { createClient } from "@/lib/supabase/server";
import type { TerminologyKey } from "@/lib/terminology/types";
import { ProfileForm } from "./_profile-form";
import { SectorPreview } from "./_sector-preview";
import { TerminologyForm } from "./_terminology-form";

export const dynamic = "force-dynamic";

export default async function TenantProfilePage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const sectorKey = result.tenant.sector_template_key;
  const settings = (result.tenant.settings_json ?? {}) as Record<string, unknown>;
  const overrideRecord = safeParseTerminology(settings.terminology_overrides) as Record<string, string>;

  const supabase = await createClient();
  const wantedKeys = Array.from(new Set([sectorKey, "generic"].filter((k): k is string => !!k)));
  const { data: rawTemplates } = wantedKeys.length
    ? await supabase
        .from("sector_templates")
        .select("key, terminology_json")
        .in("key", wantedKeys)
    : { data: [] as { key: string; terminology_json: unknown }[] };
  const byKey = new Map<string, unknown>();
  for (const t of rawTemplates ?? []) byKey.set(t.key, t.terminology_json);

  const inheritedTerminology = resolveTerminology({
    generic: byKey.get("generic"),
    sector: sectorKey ? byKey.get(sectorKey) : undefined,
  }) as unknown as Record<string, string>;

  const [terminology, templates] = await Promise.all([
    getTenantTerminology(result.tenant.id),
    listSectorTemplateNamesForRead(),
  ]);
  const matched = templates.find((t) => t.key === sectorKey) ?? null;
  const templateName = matched
    ? matched.is_active
      ? matched.name
      : `${matched.name} (inactief)`
    : null;
  const overrideKeys = Object.keys(safeParseTerminology(overrideRecord)) as TerminologyKey[];

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
        <TerminologyForm
          tenantId={result.tenant.id}
          initialOverrides={overrideRecord}
          inheritedTerminology={inheritedTerminology}
        />
      </section>
    </>
  );
}
