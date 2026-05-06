import { redirect } from "next/navigation";
import { Download, ScrollText } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getAuditLogs, getDistinctAuditActions } from "@/lib/db/audit-logs";
import { getAuditRetentionMonths } from "@/lib/db/audit-retention";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "member.archive": "Lid gearchiveerd",
  "member.unarchive": "Lid gedearchiveerd",
  "member.unlink_parent_child": "Ouder/kind ontkoppeld",
  "financial.update": "Financiële gegevens aangepast",
  "financial.iban.reveal": "IBAN onthuld",
  "payment_method.create": "Betaalmethode aangemaakt",
  "payment_method.update": "Betaalmethode bijgewerkt",
  "payment_method.archive": "Betaalmethode gearchiveerd",
  "payment_method.unarchive": "Betaalmethode gedearchiveerd",
  "profile.child.add": "Kind toegevoegd via profiel",
  "invite.create": "Uitnodiging verstuurd",
  "invite.resend": "Uitnodiging opnieuw verstuurd",
  "invite.revoke": "Uitnodiging ingetrokken",
  "role.create": "Rol aangemaakt",
  "role.update": "Rol bijgewerkt",
  "role.delete": "Rol verwijderd",
  "role.assign": "Rollen toegewezen aan lid",
  "tenant_profile.update": "Vereniging-profiel bijgewerkt",
  "news.delete": "Nieuwsbericht verwijderd",
};

function actionLabel(key: string): string {
  return ACTION_LABELS[key] ?? key;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveRoleName(id: string, roleNames: Map<string, string>): string {
  return roleNames.get(id) ?? id;
}

function formatRoleIdList(
  raw: unknown,
  roleNames: Map<string, string>,
): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const ids = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (ids.length === 0) return "—";
  return ids.map((id) => resolveRoleName(id, roleNames)).join(", ");
}

function fmtMeta(
  action: string,
  meta: Record<string, unknown>,
  roleNames: Map<string, string>,
): string {
  const keys = Object.keys(meta);
  if (keys.length === 0) return "";

  // role.assign — meta has added/removed (comma-separated UUIDs) + total.
  if (action === "role.assign") {
    const parts: string[] = [];
    if ("added" in meta) {
      parts.push(`toegevoegd=${formatRoleIdList(meta.added, roleNames)}`);
    }
    if ("removed" in meta) {
      parts.push(`verwijderd=${formatRoleIdList(meta.removed, roleNames)}`);
    }
    if ("total" in meta && meta.total !== null && meta.total !== undefined) {
      parts.push(`totaal=${String(meta.total)}`);
    }
    // Append any other unknown keys verbatim so we don't silently drop info.
    for (const k of keys) {
      if (k === "added" || k === "removed" || k === "total") continue;
      const v = meta[k];
      parts.push(`${k}=${v === null ? "∅" : String(v)}`);
    }
    return parts.join(" · ");
  }

  // role.create / role.update / role.delete — show the role name, hide the id.
  if (
    action === "role.create" ||
    action === "role.update" ||
    action === "role.delete"
  ) {
    const parts: string[] = [];
    const roleId = typeof meta.role_id === "string" ? meta.role_id : null;
    const metaName =
      typeof meta.role_name === "string" && meta.role_name.trim() !== ""
        ? meta.role_name
        : null;
    const resolvedName = roleId
      ? roleNames.get(roleId) ?? metaName ?? roleId
      : metaName;
    if (resolvedName) parts.push(`rol=${resolvedName}`);
    else parts.push("rol=—");

    for (const k of keys) {
      if (k === "role_id" || k === "role_name") continue;
      const v = meta[k];
      if (v === null) parts.push(`${k}=∅`);
      else if (typeof v === "boolean") parts.push(`${k}=${v ? "ja" : "nee"}`);
      else parts.push(`${k}=${String(v)}`);
    }
    return parts.join(" · ");
  }

  return keys
    .map((k) => {
      const v = meta[k];
      if (v === null) return `${k}=∅`;
      if (typeof v === "boolean") return `${k}=${v ? "ja" : "nee"}`;
      return `${k}=${String(v)}`;
    })
    .join(" · ");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function collectRoleIdsFromRows(
  rows: Array<{ action: string; meta: Record<string, unknown> }>,
): string[] {
  const ids = new Set<string>();
  for (const r of rows) {
    if (!r.action.startsWith("role.")) continue;
    const m = r.meta;
    if (typeof m.role_id === "string" && UUID_RE.test(m.role_id)) {
      ids.add(m.role_id);
    }
    for (const key of ["added", "removed"] as const) {
      const v = m[key];
      if (typeof v !== "string" || v.length === 0) continue;
      for (const part of v.split(",")) {
        const id = part.trim();
        if (UUID_RE.test(id)) ids.add(id);
      }
    }
  }
  return Array.from(ids);
}

async function fetchRoleNames(
  tenantId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant_roles")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .in("id", ids);
  for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
    map.set(row.id, row.name);
  }
  return map;
}

interface PageProps {
  searchParams: Promise<{
    action?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function TenantAuditPage({ searchParams }: PageProps) {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);

  if (result.kind === "no_access") redirect("/");
  if (result.kind === "needs_selection") redirect("/tenant");

  const tenantId = result.tenant.id;
  const sp = await searchParams;
  const action = sp.action?.trim() ?? "";
  const from = sp.from?.trim() ?? "";
  const to = sp.to?.trim() ?? "";

  const [rows, distinctActions, retentionMonths] = await Promise.all([
    getAuditLogs({
      tenantId,
      action: action || null,
      fromDate: from || null,
      toDate: to || null,
      limit: 200,
    }),
    getDistinctAuditActions(tenantId),
    getAuditRetentionMonths(tenantId),
  ]);

  const roleNames = await fetchRoleNames(
    tenantId,
    collectRoleIdsFromRows(rows),
  );

  const retentionLabel =
    retentionMonths === null
      ? "Events worden nooit automatisch verwijderd."
      : retentionMonths === 0
        ? "Events worden bij de eerstvolgende nachtelijke opschoning verwijderd."
        : `Events ouder dan ${retentionMonths} ${
            retentionMonths === 1 ? "maand" : "maanden"
          } worden nachtelijks automatisch verwijderd.`;

  return (
    <>
      <PageHeading
        title="Audit-log"
        description="Laatste 200 acties op gevoelige gegevens binnen deze vereniging."
      />

      <div
        className="rounded-2xl border px-4 py-3 text-xs"
        style={{
          backgroundColor: "var(--surface-soft)",
          borderColor: "var(--surface-border)",
          color: "var(--text-secondary)",
        }}
      >
        <span
          className="mr-1 font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-primary)" }}
        >
          Bewaartermijn:
        </span>
        {retentionLabel}
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="action"
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Actie
          </label>
          <select
            id="action"
            name="action"
            defaultValue={action}
            className="h-9 min-w-[14rem] rounded-md border bg-transparent px-2 text-sm"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">Alle acties</option>
            {distinctActions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)} ({a})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="from"
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Vanaf
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="to"
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Tot en met
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="h-9 rounded-md px-4 text-sm font-medium"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-primary)",
            }}
          >
            Filter
          </button>
          {(action || from || to) && (
            <a
              href="/tenant/audit"
              className="h-9 rounded-md px-3 text-sm font-medium leading-9"
              style={{ color: "var(--text-secondary)" }}
            >
              Wissen
            </a>
          )}
          <a
            href={`/tenant/audit/export${
              action || from || to
                ? "?" +
                  new URLSearchParams(
                    Object.entries({ action, from, to }).filter(
                      ([, v]) => v !== "",
                    ) as [string, string][],
                  ).toString()
                : ""
            }`}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          >
            <Download className="h-4 w-4" aria-hidden />
            Exporteer als CSV
          </a>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Geen audit-events"
          description={
            action || from || to
              ? "Geen events gevonden voor de gekozen filter."
              : "Acties zoals archiveren, IBAN-reveals en wijzigingen aan betaalmogelijkheden verschijnen hier zodra ze plaatsvinden."
          }
        />
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead
                style={{
                  backgroundColor: "var(--surface-soft)",
                  color: "var(--text-secondary)",
                }}
              >
                <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                  <th className="px-4 py-3">Wanneer</th>
                  <th className="px-4 py-3">Actie</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Lid</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody
                className="divide-y"
                style={{ borderColor: "var(--surface-border)" }}
              >
                {rows.map((r) => (
                  <tr key={r.id} style={{ color: "var(--text-primary)" }}>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <div className="font-medium">{actionLabel(r.action)}</div>
                      <div
                        className="text-[11px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {r.action}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {r.actor_email ?? (
                        <span style={{ color: "var(--text-secondary)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {r.member_name ?? (
                        <span style={{ color: "var(--text-secondary)" }}>—</span>
                      )}
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {fmtMeta(r.action, r.meta, roleNames)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
