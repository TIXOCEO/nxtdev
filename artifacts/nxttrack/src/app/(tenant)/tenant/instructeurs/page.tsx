import Link from "next/link";
import { CalendarClock, UsersRound } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { listInstructors } from "@/lib/db/instructors";
import { getTenantTerminology } from "@/lib/terminology/resolver";

export const dynamic = "force-dynamic";

export default async function TenantInstructorsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [instructors, terminology] = await Promise.all([
    listInstructors(result.tenant.id),
    getTenantTerminology(result.tenant.id),
  ]);

  return (
    <>
      <PageHeading
        title={terminology.instructor_plural}
        description={`Beheer ${terminology.instructor_plural.toLowerCase()}, beschikbaarheid en sessietoewijzingen.`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/tenant/planning/conflicten"
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              <CalendarClock className="h-3.5 w-3.5" /> Conflicten
            </Link>
            <Link
              href="/tenant/planning/onbemand"
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              Onbemand
            </Link>
          </div>
        }
      />

      {instructors.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={`Nog geen ${terminology.instructor_plural.toLowerCase()}`}
          description="Wijs leden de trainer-rol toe via Rollen & rechten of via een individuele lid-pagina."
        />
      ) : (
        <ul className="grid gap-3">
          {instructors.map((i) => (
            <li
              key={i.member_id}
              className="rounded-2xl border p-4"
              style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/tenant/instructeurs/${i.member_id}`}
                    className="text-sm font-semibold hover:underline"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {i.full_name}
                  </Link>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {i.email ?? "—"} · rol: {i.trainer_role_label ?? "trainer"}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: "var(--surface-soft)", color: "var(--text-secondary)" }}
                >
                  {i.upcoming_sessions} aankomende {i.upcoming_sessions === 1 ? "sessie" : "sessies"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
