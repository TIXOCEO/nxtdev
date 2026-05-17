import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Sprint 72 — Database helpers voor `program_stages` en `group_stages`.
 */

export interface ProgramStage {
  id: string;
  tenant_id: string;
  program_id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupStageLink {
  group_id: string;
  stage_id: string;
  tenant_id: string;
  created_at: string;
}

export async function listProgramStages(
  tenantId: string,
  programId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<ProgramStage[]> {
  const supabase = await createClient();
  let query = supabase
    .from("program_stages")
    .select(
      "id, tenant_id, program_id, name, description, color, sort_order, archived_at, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("program_id", programId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (!opts.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch program stages: ${error.message}`);
  return (data ?? []) as ProgramStage[];
}

export async function listGroupStages(
  tenantId: string,
  groupId: string,
): Promise<ProgramStage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_stages")
    .select(
      "stage_id, program_stages!inner(id, tenant_id, program_id, name, description, color, sort_order, archived_at, created_at, updated_at)",
    )
    .eq("tenant_id", tenantId)
    .eq("group_id", groupId);
  if (error) throw new Error(`Failed to fetch group stages: ${error.message}`);
  type Row = { program_stages: ProgramStage | ProgramStage[] };
  return ((data ?? []) as Row[])
    .map((r) =>
      Array.isArray(r.program_stages) ? r.program_stages[0] : r.program_stages,
    )
    .filter(Boolean)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/**
 * Voor groep-detailpagina: alle stages binnen het programma waar de groep
 * (via `groups.program_id`) aan vasthangt, plus de set actuele koppelingen.
 */
export async function getStagesContextForGroup(
  tenantId: string,
  groupId: string,
): Promise<{
  programId: string | null;
  programName: string | null;
  useStages: boolean;
  available: ProgramStage[];
  attachedStageIds: Set<string>;
}> {
  const supabase = await createClient();
  const { data: groupRow } = await supabase
    .from("groups")
    .select("id, program_id, programs(name, use_stages)")
    .eq("id", groupId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!groupRow) {
    return {
      programId: null,
      programName: null,
      useStages: false,
      available: [],
      attachedStageIds: new Set(),
    };
  }
  const programId = (groupRow as { program_id: string | null }).program_id;
  const programsRaw = (
    groupRow as unknown as {
      programs:
        | { name: string; use_stages: boolean }
        | Array<{ name: string; use_stages: boolean }>
        | null;
    }
  ).programs;
  const programRow = Array.isArray(programsRaw) ? (programsRaw[0] ?? null) : programsRaw;
  const programName = programRow?.name ?? null;
  const useStages = Boolean(programRow?.use_stages);

  const [available, attached] = await Promise.all([
    programId ? listProgramStages(tenantId, programId) : Promise.resolve([] as ProgramStage[]),
    listGroupStages(tenantId, groupId),
  ]);
  return {
    programId,
    programName,
    useStages,
    available,
    attachedStageIds: new Set(attached.map((s) => s.id)),
  };
}
