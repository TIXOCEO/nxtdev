import { redirect } from "next/navigation";
import { Download, ScrollText } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getAuditLogs, getDistinctAuditActions } from "@/lib/db/audit-logs";

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

function fmtMeta(meta: Record<string, unknown>): string {
  const keys = Object.keys(meta);
  if (keys.length === 0) return "";
  return keys
    .map((k) => {
      const v = meta[k];
      if (v === null) return `${k}=∅`;
      if (typeof v === "boolean") return `${k}=${v ? "ja" : "nee"}`;
      return `${k}=${String(v)}`;
    })
    .join(" · ");
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

  const [rows, distinctActions] = await Promise.all([
    getAuditLogs({
      tenantId,
      action: action || null,
      fromDate: from || null,
      toDate: to || null,
      limit: 200,
    }),
    getDistinctAuditActions(tenantId),
  ]);

  return (
    <>
      <PageHeading
        title="Audit-log"
        description="Laatste 200 acties op gevoelige gegevens binnen deze vereniging."
      />

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
                      {fmtMeta(r.meta)}
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
