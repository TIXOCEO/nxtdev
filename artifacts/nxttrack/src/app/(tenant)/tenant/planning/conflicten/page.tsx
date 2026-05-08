import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { detectConflicts } from "@/lib/db/instructors";

export const dynamic = "force-dynamic";

interface SP {
  days?: string;
}

const KIND_LABEL: Record<string, string> = {
  overlap: "Dubbele boeking",
  unavailable_block: "Afwezig",
  not_available_weekly: "Buiten beschikbaarheid",
  understaffed: "Onderbezet",
};

const KIND_COLOR: Record<string, string> = {
  overlap: "#dc2626",
  unavailable_block: "#d97706",
  not_available_weekly: "#d97706",
  understaffed: "#7c3aed",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ConflictenPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const days = Math.max(1, Math.min(180, Number.parseInt(sp.days ?? "30", 10) || 30));
  const fromIso = new Date().toISOString();
  const toIso = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const conflicts = await detectConflicts(result.tenant.id, fromIso, toIso);

  return (
    <>
      <PageHeading
        title="Plannings­conflicten"
        description={`Conflicten in de komende ${days} dagen.`}
        actions={
          <form className="flex items-center gap-2">
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Horizon
            </label>
            <select
              name="days"
              defaultValue={String(days)}
              className="h-9 rounded-lg border bg-transparent px-2 text-xs"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              <option value="7">7 dagen</option>
              <option value="14">14 dagen</option>
              <option value="30">30 dagen</option>
              <option value="90">90 dagen</option>
            </select>
            <button type="submit" className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}>
              Toon
            </button>
          </form>
        }
      />

      {conflicts.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Geen conflicten gevonden"
          description="In de gekozen horizon zijn geen overlap, afwezigheids- of onderbezettings-issues."
        />
      ) : (
        <ul className="grid gap-2">
          {conflicts.map((c, i) => (
            <li
              key={`${c.session_id}-${c.member_id ?? "x"}-${i}`}
              className="rounded-2xl border p-3"
              style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ backgroundColor: KIND_COLOR[c.conflict_kind] + "20", color: KIND_COLOR[c.conflict_kind] }}
                    >
                      {KIND_LABEL[c.conflict_kind] ?? c.conflict_kind}
                    </span>
                    <Link
                      href={`/tenant/trainings/${c.session_id}`}
                      className="text-sm font-medium hover:underline"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {c.session_title ?? c.session_id}
                    </Link>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {fmt(c.session_starts_at)}
                    {c.member_full_name ? ` · ${c.member_full_name}` : ""}
                    {" · "}{c.detail}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
