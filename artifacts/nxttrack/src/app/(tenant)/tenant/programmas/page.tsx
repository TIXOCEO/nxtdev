import Link from "next/link";
import { Plus, FolderTree } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { listProgramsPage } from "@/lib/db/programs";
import { listProgramCapacityHighlights } from "@/lib/db/program-capacity";
import {
  capacityHex,
  capacityLabel,
  capacityDescription,
} from "@/lib/ui/capacity-color";

export const dynamic = "force-dynamic";

const VISIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  public: { label: "Publiek", color: "#16a34a" },
  internal: { label: "Intern", color: "#64748b" },
  archived: { label: "Archief", color: "#94a3b8" },
};

function formatSessionDate(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("nl-NL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

export default async function TenantProgramsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [programs, terminology, highlights] = await Promise.all([
    listProgramsPage(result.tenant.id),
    getTenantTerminology(result.tenant.id),
    listProgramCapacityHighlights(result.tenant.id),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeading
          title={terminology.program_plural}
          description={terminology.programs_page_description}
        />
        <Link
          href="/tenant/programmas/nieuw"
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-4 w-4" /> {terminology.programs_new_button}
        </Link>
      </div>

      {programs.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={`Nog geen ${terminology.program_plural.toLowerCase()}`}
          description={`Maak een ${terminology.program_singular.toLowerCase()} aan om ${terminology.group_plural.toLowerCase()} te bundelen onder één planning-eenheid met capaciteit-defaults en marketplace-velden.`}
        />
      ) : (
        <ul className="grid gap-3">
          {programs.map((p) => {
            const v = VISIBILITY_LABELS[p.visibility] ?? VISIBILITY_LABELS.internal;
            const hi = highlights.get(p.id);
            const capColor = hi
              ? capacityHex(hi.used_count, hi.fixed_capacity, hi.flex_capacity)
              : null;
            const capLabel = hi
              ? capacityLabel(hi.used_count, hi.fixed_capacity, hi.flex_capacity)
              : null;
            const capDesc = hi
              ? capacityDescription(hi.used_count, hi.fixed_capacity, hi.flex_capacity)
              : null;

            return (
              <li
                key={p.id}
                className="overflow-hidden rounded-2xl border"
                style={{
                  backgroundColor: "var(--surface-main)",
                  borderColor: "var(--surface-border)",
                }}
              >
                {capColor && (
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: capColor }}
                    aria-hidden="true"
                  />
                )}
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/tenant/programmas/${p.id}`}
                        className="text-sm font-semibold hover:underline"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {p.name}
                      </Link>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span className="font-mono">{p.slug}</span>
                        {" · "}
                        {p.group_count}{" "}
                        {p.group_count === 1
                          ? terminology.group_singular.toLowerCase()
                          : terminology.group_plural.toLowerCase()}
                        {p.default_capacity != null ? ` · capaciteit ${p.default_capacity}` : ""}
                        {p.default_flex_capacity != null && p.default_flex_capacity > 0
                          ? ` (+${p.default_flex_capacity} flex)`
                          : ""}
                      </p>
                      {hi && capLabel && (
                        <p
                          className="mt-1 text-[11px]"
                          style={{ color: "var(--text-secondary)" }}
                          title={capDesc ?? undefined}
                        >
                          <span
                            className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                            style={{ backgroundColor: capColor ?? "transparent" }}
                            aria-hidden="true"
                          />
                          {capLabel} — {hi.session_title} · {formatSessionDate(hi.starts_at)}
                          {hi.fixed_capacity != null
                            ? ` (${hi.used_count}/${hi.fixed_capacity})`
                            : ""}
                        </p>
                      )}
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ backgroundColor: v.color, color: "#fff" }}
                    >
                      {v.label}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
