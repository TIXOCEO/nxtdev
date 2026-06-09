import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { listDiplomasForTenant } from "@/lib/db/child-diplomas";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewDiplomaForm } from "./_new-diploma-form";
import { Award } from "lucide-react";

export const dynamic = "force-dynamic";

interface MemberOption {
  id: string;
  full_name: string;
}

async function listActiveMembers(tenantId: string): Promise<MemberOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("members")
    .select("id, full_name, archived_at")
    .eq("tenant_id", tenantId)
    .is("archived_at", null)
    .order("full_name", { ascending: true });
  return ((data ?? []) as Array<{ id: string; full_name: string }>).map((m) => ({
    id: m.id,
    full_name: m.full_name,
  }));
}

export default async function TenantDiplomasPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [diplomas, members] = await Promise.all([
    listDiplomasForTenant(result.tenant.id),
    listActiveMembers(result.tenant.id),
  ]);

  const memberName = new Map(members.map((m) => [m.id, m.full_name]));

  return (
    <>
      <PageHeading title="Diploma's" description="Ken behaalde diploma's toe aan leden." />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--surface-card)" }}>
          {diplomas.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Award} title="Nog geen diploma's toegekend" description="Voeg hieronder het eerste diploma toe." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider" style={{ borderColor: "var(--shell-border)", color: "var(--text-secondary)" }}>
                  <th className="px-4 py-2">Diploma</th>
                  <th className="px-4 py-2">Lid</th>
                  <th className="px-4 py-2">Niveau</th>
                  <th className="px-4 py-2">Datum</th>
                </tr>
              </thead>
              <tbody>
                {diplomas.map((d) => (
                  <tr key={d.id} className="border-b last:border-b-0" style={{ borderColor: "var(--shell-border)" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>
                      {d.diploma_name}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {memberName.get(d.member_id) ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {d.level ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {new Date(d.awarded_on).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <NewDiplomaForm tenantId={result.tenant.id} members={members} />
      </div>
    </>
  );
}
