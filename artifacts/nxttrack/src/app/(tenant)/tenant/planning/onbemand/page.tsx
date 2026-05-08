import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { listUnderstaffed } from "@/lib/db/instructors";
import { getTenantTerminology } from "@/lib/terminology/resolver";

export const dynamic = "force-dynamic";

interface SP {
  days?: string;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function OnbemandPage({
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
  const [rows, terminology] = await Promise.all([
    listUnderstaffed(result.tenant.id, fromIso, toIso),
    getTenantTerminology(result.tenant.id),
  ]);
  const instrPlural = terminology.instructor_plural.toLowerCase();

  return (
    <>
      <PageHeading
        title="Onbemande sessies"
        description={`Sessies met minder dan vereiste primary-${instrPlural} in de komende ${days} dagen.`}
      />
      <div className="mb-3 rounded-xl border px-3 py-2 text-xs" style={{ backgroundColor: "var(--surface-soft)", borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
        Stel een minimum in per groep (Groepen → bewerken) of overschrijf het per sessie.
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Geen onbemande sessies"
          description={`Alle sessies hebben voldoende primary-${instrPlural}.`}
        />
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li
              key={r.session_id}
              className="rounded-2xl border p-3"
              style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/tenant/trainings/${r.session_id}`}
                    className="text-sm font-medium hover:underline"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {r.title}
                  </Link>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {fmt(r.starts_at)} · {r.group_name}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}
                >
                  {r.have} / {r.need}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
