import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { assertTenantAccess } from "@/lib/actions/tenant/_assert-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { SECTOR_DEFAULT_FORMS } from "@/lib/intake/sector-defaults";
import { IntakeFormCreateButton } from "./_create-button";
import { IntakeFormImportButton } from "./_import-button";

interface FormRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  is_default: boolean;
  updated_at: string;
}

const STATUS_LABEL: Record<FormRow["status"], string> = {
  draft: "Concept",
  published: "Gepubliceerd",
  archived: "Gearchiveerd",
};

interface SearchParams {
  status?: string;
}

export default async function IntakeFormsListPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const tenantId = await readActiveTenantCookie();
  if (!tenantId) redirect("/login");
  await assertTenantAccess(tenantId);

  const admin = createAdminClient();
  const { data: tRow } = await admin
    .from("tenants")
    .select("settings_json, sector_template_key")
    .eq("id", tenantId)
    .maybeSingle();
  const settings = (tRow?.settings_json ?? {}) as Record<string, unknown>;
  const dynamicIntakeEnabled = settings.dynamic_intake_enabled === true;

  const sp = (await searchParams) ?? {};
  const statusFilter = (sp.status ?? "").trim();

  let q = admin
    .from("intake_forms")
    .select("id, slug, name, description, status, is_default, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (statusFilter) q = q.eq("status", statusFilter);

  const { data, error } = await q;
  const rows = (data ?? []) as FormRow[];
  const sectorKeys = Object.keys(SECTOR_DEFAULT_FORMS);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Intake-formulieren"
        description="Beheer eigen aanmeldformulieren. Een gepubliceerd formulier kan automatisch op de inschrijfpagina worden ingezet."
      />

      {!dynamicIntakeEnabled ? (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Dynamic intake is uit voor deze tenant. Je kunt hier wel
            formulieren voorbereiden, maar ze worden pas getoond op de
            publieke pagina zodra een platform-admin{" "}
            <code>settings_json.dynamic_intake_enabled = true</code> zet.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <IntakeFormCreateButton tenantId={tenantId} />
        <IntakeFormImportButton tenantId={tenantId} sectorKeys={sectorKeys} />
        <form
          method="get"
          className="ml-auto flex items-end gap-2"
        >
          <label className="flex flex-col text-xs">
            <span style={{ color: "var(--text-secondary)" }}>Status</span>
            <select
              name="status"
              defaultValue={statusFilter}
              className="mt-1 rounded-md border px-2 py-1 text-sm"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--bg-input, var(--surface))",
              }}
            >
              <option value="">Alle</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md px-3 py-1.5 text-sm font-medium"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-foreground, white)",
            }}
          >
            Filter
          </button>
        </form>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Fout bij laden: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <div
          className="rounded-2xl p-6 text-sm"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          Nog geen formulieren. Maak er een aan of importeer een
          sector-template als startpunt.
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <table className="w-full text-left text-sm">
            <thead style={{ backgroundColor: "var(--bg-muted, var(--surface))" }}>
              <tr>
                <th className="px-4 py-3 font-medium">Naam</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Default</th>
                <th className="px-4 py-3 font-medium">Bijgewerkt</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/tenant/intake/forms/${r.id}`}
                      className="font-medium underline"
                    >
                      {r.name}
                    </Link>
                    {r.description ? (
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {r.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.slug}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-xs"
                      style={{
                        backgroundColor:
                          r.status === "published"
                            ? "var(--success-soft, #d1fae5)"
                            : r.status === "draft"
                              ? "var(--warning-soft, #fef3c7)"
                              : "var(--bg-muted, #e5e7eb)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.is_default ? (
                      <span className="text-xs">Standaard</span>
                    ) : (
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {new Date(r.updated_at).toLocaleString("nl-NL")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/tenant/intake/forms/${r.id}/builder`}
                      className="text-xs underline"
                    >
                      Bouwer
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
