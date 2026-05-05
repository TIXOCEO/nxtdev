import { Users } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getMembersByTenant } from "@/lib/db/members";
import { MemberCard } from "@/components/tenant/member-card";
import { AddMemberWizard } from "./_add-member-wizard";
import { getPlansByTenant } from "@/lib/db/membership-plans";
import { getUserPermissionsInTenant } from "@/lib/db/tenant-roles";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  parent: "Ouder",
  athlete: "Speler",
  trainer: "Trainer",
  staff: "Staf",
  volunteer: "Vrijwilliger",
};

export default async function TenantMembersPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const members = await getMembersByTenant(result.tenant.id);
  const existingParents = members
    .filter((m) => m.roles.includes("parent"))
    .map((m) => ({ id: m.id, full_name: m.full_name }));

  // Sprint D: gate "Voeg toe". Alleen platform_admin, tenant_admin
  // (enum-membership) of een gebruiker met expliciete
  // `members.create` / `members.write` permissie krijgt de knop te zien.
  // Een generieke admin-scope tenant-rol zonder expliciete rechten
  // mag deze module dus NIET zien (zero-permission staff/trainer).
  const isTenantAdminEnum = result.membership?.role === "tenant_admin";
  const explicitPerms = result.isPlatformAdmin || isTenantAdminEnum
    ? []
    : await getUserPermissionsInTenant(result.tenant.id, result.user.id);
  const canAdd =
    result.isPlatformAdmin ||
    isTenantAdminEnum ||
    explicitPerms.includes("members.create") ||
    explicitPerms.includes("members.write");

  // Optionele subscription-keuze tijdens aanmaken: alleen tonen als
  // de tenant lidmaatschapsplannen heeft.
  const allPlans = canAdd ? await getPlansByTenant(result.tenant.id) : [];
  const activePlans = allPlans
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <PageHeading
        title="Leden"
        description="Beheer ouders, sporters, trainers en staf van deze vereniging."
        actions={
          canAdd ? (
            <AddMemberWizard
              tenantId={result.tenant.id}
              existingParents={existingParents}
              membershipPlans={activePlans}
            />
          ) : null
        }
      />

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nog geen leden"
          description="Klik rechtsboven op 'Voeg toe' om het eerste lid aan te maken."
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-3 md:hidden">
            {members.map((m) => (
              <li key={m.id}>
                <MemberCard
                  member={m}
                  roles={m.roles}
                  groupNames={m.group_names}
                  href={`/tenant/members/${m.id}`}
                />
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div
            className="hidden overflow-hidden rounded-2xl border md:block"
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
                    <th className="px-5 py-3">Naam</th>
                    <th className="px-5 py-3">Rollen</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Groepen</th>
                    <th className="px-5 py-3 text-right">Acties</th>
                  </tr>
                </thead>
                <tbody
                  className="divide-y"
                  style={{ borderColor: "var(--surface-border)" }}
                >
                  {members.map((m) => (
                    <tr key={m.id} style={{ color: "var(--text-primary)" }}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{m.full_name}</p>
                        {m.email && (
                          <p
                            className="text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {m.email}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {m.roles.length > 0
                          ? m.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ")
                          : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={m.member_status} />
                      </td>
                      <td
                        className="px-5 py-3 text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {m.group_names.length > 0 ? m.group_names.join(", ") : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <a
                          href={`/tenant/members/${m.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Bekijk
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
