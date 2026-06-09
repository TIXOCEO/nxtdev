import Link from "next/link";
import { Sparkles, Plus, Pencil } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { listTenantEvents } from "@/lib/db/tenant-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicShowSessionsToggle } from "./_public-show-sessions-toggle";

export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TenantEventsListPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const events = await listTenantEvents(result.tenant.id);

  const admin = createAdminClient();
  const { data: t } = await admin
    .from("tenants")
    .select("settings_json")
    .eq("id", result.tenant.id)
    .maybeSingle();
  const settings = (t?.settings_json ?? {}) as Record<string, unknown>;
  const showUpcoming = settings.public_show_upcoming_sessions === true;

  return (
    <>
      <PageHeading
        title="Events"
        description="Beheer uitgelichte events op de publieke homepage."
        actions={
          <Link
            href="/tenant/events/new"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="h-4 w-4" /> Nieuw event
          </Link>
        }
      />

      <div
        className="rounded-2xl border p-4 sm:p-5"
        style={{ backgroundColor: "var(--shell-panel-strong)", borderColor: "var(--shell-border)" }}
      >
        <PublicShowSessionsToggle
          tenantId={result.tenant.id}
          initialEnabled={showUpcoming}
        />
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nog geen events"
          description="Maak een nieuw event aan om te tonen op de publieke homepage."
          action={
            <Link
              href="/tenant/events/new"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              <Plus className="h-4 w-4" /> Nieuw event
            </Link>
          }
        />
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ backgroundColor: "var(--shell-panel-strong)", borderColor: "var(--shell-border)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "var(--shell-panel-muted)", color: "var(--text-secondary)" }}>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                  <th className="px-5 py-3">Titel</th>
                  <th className="px-5 py-3">Start</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Uitgelicht</th>
                  <th className="px-5 py-3 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--shell-border)" }}>
                {events.map((e) => (
                  <tr key={e.id} style={{ color: "var(--text-primary)" }}>
                    <td className="px-5 py-3 font-medium">{e.title}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {fmt(e.starts_at)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-5 py-3 text-xs">{e.is_featured ? "Ja" : "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/tenant/events/${e.id}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Bewerken
                      </Link>
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
