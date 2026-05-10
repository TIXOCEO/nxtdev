import Link from "next/link";
import { Plus, FolderTree } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { listProgramsPage } from "@/lib/db/programs";

export const dynamic = "force-dynamic";

const VISIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  public: { label: "Publiek", color: "#16a34a" },
  internal: { label: "Intern", color: "#64748b" },
  archived: { label: "Archief", color: "#94a3b8" },
};

export default async function TenantProgramsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [programs, terminology] = await Promise.all([
    listProgramsPage(result.tenant.id),
    getTenantTerminology(result.tenant.id),
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
            return (
              <li
                key={p.id}
                className="rounded-2xl border p-4"
                style={{
                  backgroundColor: "var(--surface-main)",
                  borderColor: "var(--surface-border)",
                }}
              >
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
                      {p.group_count} {p.group_count === 1 ? terminology.group_singular.toLowerCase() : terminology.group_plural.toLowerCase()}
                      {p.default_capacity != null ? ` · capaciteit ${p.default_capacity}` : ""}
                      {p.default_flex_capacity != null && p.default_flex_capacity > 0 ? ` (+${p.default_flex_capacity} flex)` : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: v.color, color: "#fff" }}
                  >
                    {v.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
