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
import { StagesTab } from "./_stages-tab";
import { listProgramStages } from "@/lib/db/program-stages";

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

      {activeTab === "stages" && (
        <StagesTabSection
          tenantId={tenantId}
          programId={program.id}
          useStages={Boolean((program as { use_stages?: boolean }).use_stages)}
        />
      )}
    </>
  );
}

async function StagesTabSection({
  tenantId,
  programId,
  useStages,
}: {
  tenantId: string;
  programId: string;
  useStages: boolean;
}) {
  const stages = await listProgramStages(tenantId, programId, { includeArchived: true });

  // Sprint 82b — wachttijd-info per stage. View
  // `program_group_waitlist_estimate` heeft (group_id, stage_id) — voor de
  // stage-tab aggregeren we per stage_id over alle groepen die deze stage
  // gebruiken: SUM(waitlist_count) en MAX(estimated_wait_weeks). Best-effort:
  // bij view-fout / geen rows blijft de tab gewoon werken zonder badges.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const waitInfoByStageId: Record<string, { weeks: number; count: number }> = {};
  try {
    const stageIds = stages.map((s) => s.id);
    if (stageIds.length > 0) {
      const { data: rows } = await admin
        .from("program_group_waitlist_estimate")
        .select("stage_id, current_waitlist_count, estimated_wait_weeks")
        .eq("tenant_id", tenantId)
        .in("stage_id", stageIds);
      for (const r of (rows ?? []) as Array<{
        stage_id: string | null;
        current_waitlist_count: number | null;
        estimated_wait_weeks: number | null;
      }>) {
        if (!r.stage_id) continue;
        const prev = waitInfoByStageId[r.stage_id] ?? { weeks: 0, count: 0 };
        waitInfoByStageId[r.stage_id] = {
          weeks: Math.max(prev.weeks, Number(r.estimated_wait_weeks ?? 0)),
          count: prev.count + Number(r.current_waitlist_count ?? 0),
        };
      }
    }
  } catch {
    /* swallow — wachttijd-kolom is best-effort */
  }

  return (
    <StagesTab
      tenantId={tenantId}
      programId={programId}
      useStages={useStages}
      stages={stages.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        color: s.color,
        sort_order: s.sort_order,
        archived_at: s.archived_at,
      }))}
      waitInfoByStageId={waitInfoByStageId}
    />
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
