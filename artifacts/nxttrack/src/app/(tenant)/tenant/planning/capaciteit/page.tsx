import Link from "next/link";
import { Activity } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { listCapacityOverview } from "@/lib/db/program-capacity";
import {
  capacityStatus,
  capacityHex,
  capacityLabel,
  capacityDescription,
  CAPACITY_LABEL,
  CAPACITY_HEX,
  type CapacityStatus,
} from "@/lib/ui/capacity-color";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("nl-NL", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

const STATUS_ORDER: CapacityStatus[] = ["red", "blue", "orange", "green", "gray"];

export default async function TenantCapacityPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const rows = await listCapacityOverview(result.tenant.id, 90);

  // Bucketten per status zodat kritieke sessies bovenaan staan; binnen
  // bucket op starts_at oplopend (komt al sorted uit de view).
  const buckets = new Map<CapacityStatus, typeof rows>();
  for (const s of STATUS_ORDER) buckets.set(s, []);
  for (const r of rows) {
    const s = capacityStatus(r.used_count, r.fixed_capacity, r.flex_capacity);
    buckets.get(s)!.push(r);
  }

  const counts = STATUS_ORDER.map((s) => ({ status: s, count: buckets.get(s)!.length }));

  return (
    <>
      <PageHeading
        title="Capaciteit-overzicht"
        description="Bezetting van geplande sessies in de komende 90 dagen, gesorteerd op urgentie. Kleur per cascade sessie-resources → groep-cap → programma-default."
      />

      <div
        className="mb-4 flex flex-wrap gap-2 rounded-2xl border p-3"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        {counts.map((c) => (
          <div
            key={c.status}
            className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px]"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: CAPACITY_HEX[c.status] }}
              aria-hidden="true"
            />
            {CAPACITY_LABEL[c.status]}: <strong style={{ color: "var(--text-primary)" }}>{c.count}</strong>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Geen geplande sessies"
          description="Er zijn geen sessies gepland in de komende 90 dagen, of je hebt geen toegang tot de relevante groepen."
        />
      ) : (
        <ul className="grid gap-2">
          {STATUS_ORDER.flatMap((s) =>
            buckets.get(s)!.map((r) => {
              const color = capacityHex(r.used_count, r.fixed_capacity, r.flex_capacity);
              const label = capacityLabel(r.used_count, r.fixed_capacity, r.flex_capacity);
              const desc = capacityDescription(r.used_count, r.fixed_capacity, r.flex_capacity);
              return (
                <li
                  key={r.session_id}
                  className="overflow-hidden rounded-2xl border"
                  style={{
                    backgroundColor: "var(--surface-main)",
                    borderColor: "var(--surface-border)",
                  }}
                >
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <Link
                        href={`/tenant/trainings/${r.session_id}`}
                        className="text-sm font-semibold hover:underline"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {r.session_title}
                      </Link>
                      <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {formatDateTime(r.starts_at)}
                        {r.group_name ? ` · ${r.group_name}` : ""}
                        {r.program_name ? ` · ${r.program_name}` : ""}
                      </p>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        {label} — {desc}
                        {r.fixed_capacity_source && (
                          <span className="ml-1 opacity-70">
                            (cap-bron: {r.fixed_capacity_source === "session_resources" ? "sessie-resources" : r.fixed_capacity_source === "group" ? "groep" : "programma"})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              );
            }),
          )}
        </ul>
      )}
    </>
  );
}
