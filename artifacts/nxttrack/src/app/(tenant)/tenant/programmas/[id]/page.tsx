import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import {
  getProgramById,
  listProgramGroups,
  listAvailableGroupsForProgram,
} from "@/lib/db/programs";
import {
  listProgramInstructors,
  listAvailableTrainersForProgram,
  listProgramResources,
  listAvailableResourcesForProgram,
} from "@/lib/db/program-planning";
import {
  listProgramMembershipPlans,
  listAvailableMembershipPlansForProgram,
} from "@/lib/db/program-membership-plans";
import { ProgramDetailTabs, isValidTab } from "./_tab-nav";
import { OverviewForm } from "./_overview-form";
import { GroupsTab } from "./_groups-tab";
import { InstructorsTab } from "./_instructors-tab";
import { ResourcesTab } from "./_resources-tab";
import { MembershipPlansTab } from "./_membership-plans-tab";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export const dynamic = "force-dynamic";

export default async function ProgramDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const activeTab = isValidTab(sp.tab) ? sp.tab : "overzicht";

  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const tenantId = result.tenant.id;
  const program = await getProgramById(tenantId, id);
  if (!program) notFound();

  const terminology = await getTenantTerminology(tenantId);

  return (
    <>
      <Link
        href="/tenant/programmas"
        className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar {terminology.program_plural.toLowerCase()}
      </Link>

      <PageHeading
        title={program.name}
        description={
          program.visibility === "public"
            ? "Publiek zichtbaar"
            : program.visibility === "archived"
              ? "Gearchiveerd"
              : "Interne planning-eenheid"
        }
      />

      <ProgramDetailTabs programId={program.id} active={activeTab} />

      {activeTab === "overzicht" && (
        <OverviewForm tenantId={tenantId} program={program} />
      )}

      {activeTab === "groepen" && (
        <GroupsTabSection tenantId={tenantId} programId={program.id} />
      )}

      {activeTab === "instructeurs" && (
        <InstructorsTabSection
          tenantId={tenantId}
          programId={program.id}
          leadLabel={terminology.program_assignment_lead_label}
        />
      )}

      {activeTab === "resources" && (
        <ResourcesTabSection tenantId={tenantId} programId={program.id} />
      )}

      {activeTab === "lidmaatschap" && (
        <MembershipPlansTabSection tenantId={tenantId} programId={program.id} />
      )}
    </>
  );
}

async function MembershipPlansTabSection({
  tenantId,
  programId,
}: {
  tenantId: string;
  programId: string;
}) {
  const [assigned, available] = await Promise.all([
    listProgramMembershipPlans(tenantId, programId),
    listAvailableMembershipPlansForProgram(tenantId, programId),
  ]);
  return (
    <MembershipPlansTab
      tenantId={tenantId}
      programId={programId}
      assigned={assigned}
      available={available}
    />
  );
}

async function GroupsTabSection({ tenantId, programId }: { tenantId: string; programId: string }) {
  const [linked, available] = await Promise.all([
    listProgramGroups(tenantId, programId),
    listAvailableGroupsForProgram(tenantId, programId),
  ]);
  return (
    <GroupsTab
      tenantId={tenantId}
      programId={programId}
      linked={linked}
      available={available}
    />
  );
}

async function InstructorsTabSection({
  tenantId,
  programId,
  leadLabel,
}: {
  tenantId: string;
  programId: string;
  leadLabel: string;
}) {
  const [assigned, available] = await Promise.all([
    listProgramInstructors(tenantId, programId),
    listAvailableTrainersForProgram(tenantId, programId),
  ]);
  return (
    <InstructorsTab
      tenantId={tenantId}
      programId={programId}
      assigned={assigned}
      available={available}
      leadLabel={leadLabel}
    />
  );
}

async function ResourcesTabSection({ tenantId, programId }: { tenantId: string; programId: string }) {
  const [assigned, available] = await Promise.all([
    listProgramResources(tenantId, programId),
    listAvailableResourcesForProgram(tenantId, programId),
  ]);
  return (
    <ResourcesTab
      tenantId={tenantId}
      programId={programId}
      assigned={assigned}
      available={available}
    />
  );
}
