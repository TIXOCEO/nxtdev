import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { TabShell, type TabShellTab } from "@/components/ui/tab-shell";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getMemberWithRelations, getMembersByTenant } from "@/lib/db/members";
import { getGroupsByTenant } from "@/lib/db/groups";
import { getPlansByTenant } from "@/lib/db/membership-plans";
import { getMemberFinancialDetails } from "@/lib/db/financial-details";
import { getActivePaymentMethods } from "@/lib/db/payment-methods";
import { getUserPermissionsInTenant } from "@/lib/db/tenant-roles";
import { getTenantDefaults } from "@/lib/actions/tenant/payments";
import { getAuditLogs } from "@/lib/db/audit-logs";
import { getEmailLogsByMemberEmail } from "@/lib/db/email-logs";
import { ArchiveButton } from "./_archive-controls";
import {
  OverviewTab,
  PersonalTab,
  SportTab,
  FamilyTab,
  BillingTab,
  CommunicationTab,
  AuditTab,
} from "./_detail-tabs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params;

  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const data = await getMemberWithRelations(id, result.tenant.id);
  if (!data) notFound();

  const isTenantAdminEnum = result.membership?.role === "tenant_admin";
  const explicitPerms =
    result.isPlatformAdmin || isTenantAdminEnum
      ? []
      : await getUserPermissionsInTenant(result.tenant.id, result.user.id);

  const isAdmin = result.isPlatformAdmin || isTenantAdminEnum;
  const canArchive = isAdmin || explicitPerms.includes("members.archive");
  const canViewFinancial = isAdmin || explicitPerms.includes("members.financial.view");
  const canManageFinancial = isAdmin || explicitPerms.includes("members.financial.manage");
  const canEditRoles = isAdmin || explicitPerms.includes("members.write");

  const [
    allGroups,
    allPlans,
    allMembers,
    financialRow,
    paymentMethods,
    defaults,
    emailLogs,
    auditRows,
  ] = await Promise.all([
    getGroupsByTenant(result.tenant.id),
    getPlansByTenant(result.tenant.id),
    getMembersByTenant(result.tenant.id),
    canViewFinancial
      ? getMemberFinancialDetails(data.member.id, result.tenant.id)
      : Promise.resolve(null),
    getActivePaymentMethods(result.tenant.id),
    getTenantDefaults(result.tenant.id),
    getEmailLogsByMemberEmail(result.tenant.id, data.member.email, 50),
    getAuditLogs({
      tenantId: result.tenant.id,
      memberId: data.member.id,
      limit: 200,
    }),
  ]);

  const roleNames = data.roles.map((r) => r.role);
  const isParentRole = roleNames.includes("parent");
  const isAthleteRole = roleNames.includes("athlete");
  const isTrainerRole = roleNames.includes("trainer");

  const linkableChildren = allMembers
    .filter(
      (m) =>
        m.id !== data.member.id &&
        !data.children.some((c) => c.id === m.id),
    )
    .map((m) => ({ id: m.id, full_name: m.full_name }));

  const activePlans = allPlans
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.id, name: p.name }));

  const archived = !!data.member.archived_at;

  const athleteCodeDisplay =
    isAthleteRole || isTrainerRole
      ? `ATH-${data.member.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
      : null;

  const tabs: TabShellTab[] = [
    {
      key: "overview",
      label: "Overzicht",
      content: (
        <OverviewTab
          tenantId={result.tenant.id}
          member={data.member}
          roles={roleNames}
          athleteCodeDisplay={athleteCodeDisplay}
          canEditRoles={canEditRoles}
        />
      ),
    },
    {
      key: "personal",
      label: "Persoonlijk",
      content: (
        <PersonalTab tenantId={result.tenant.id} member={data.member} />
      ),
    },
    {
      key: "sport",
      label: "Sport",
      content: (
        <SportTab
          tenantId={result.tenant.id}
          member={data.member}
          allGroups={allGroups}
          currentGroups={data.groups}
          isTrainerRole={isTrainerRole}
          athleteCodeDisplay={athleteCodeDisplay}
        />
      ),
    },
    {
      key: "family",
      label: "Familie",
      content: (
        <FamilyTab
          tenantId={result.tenant.id}
          member={data.member}
          parents={data.parents.map((p) => ({ id: p.id, full_name: p.full_name }))}
          children={data.children.map((c) => ({ id: c.id, full_name: c.full_name }))}
          isAthleteRole={isAthleteRole}
          isParentRole={isParentRole}
          linkableChildren={linkableChildren}
        />
      ),
    },
    {
      key: "billing",
      label: "Abonnement & Betalingen",
      content: (
        <BillingTab
          tenantId={result.tenant.id}
          member={data.member}
          memberships={data.memberships}
          payments={data.payments}
          paymentMethods={paymentMethods}
          defaultPaymentMethodId={defaults.payment_method?.id ?? null}
          activePlans={activePlans}
          financial={financialRow}
          canViewFinancial={canViewFinancial}
          canManageFinancial={canManageFinancial}
        />
      ),
    },
    {
      key: "communication",
      label: "Communicatie",
      badge: emailLogs.length > 0 ? emailLogs.length : undefined,
      content: <CommunicationTab logs={emailLogs} />,
    },
    {
      key: "audit",
      label: "Logboek",
      badge: auditRows.length > 0 ? auditRows.length : undefined,
      content: <AuditTab logs={auditRows} />,
    },
  ];

  return (
    <>
      <div
        className="flex items-center gap-2 text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        <Link
          href="/tenant/members"
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar leden
        </Link>
      </div>

      <PageHeading
        title={data.member.full_name}
        description="Leddetails, koppelingen, abonnement en betalingen."
        actions={
          canArchive ? (
            <ArchiveButton
              tenantId={result.tenant.id}
              memberId={data.member.id}
              archived={archived}
            />
          ) : null
        }
      />

      {archived && (
        <div
          className="flex items-start gap-2 rounded-2xl border p-3 text-sm"
          style={{
            backgroundColor: "color-mix(in oklab, #facc15 20%, var(--surface-main))",
            borderColor: "color-mix(in oklab, #ca8a04 50%, var(--surface-border))",
            color: "var(--text-primary)",
          }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Dit lid is gearchiveerd.</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Bewerkingen blijven mogelijk, maar het lid wordt verborgen uit de
              standaard ledenlijst en kan niet meer kiezen voor publieke
              betaalmethoden.
            </p>
          </div>
        </div>
      )}

      <TabShell tabs={tabs} defaultKey="overview" />
    </>
  );
}
