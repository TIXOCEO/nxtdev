"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import {
  createProgramStageSchema,
  updateProgramStageSchema,
  archiveProgramStageSchema,
  setProgramUseStagesSchema,
  attachGroupStageSchema,
  detachGroupStageSchema,
  reorderProgramStagesSchema,
  type CreateProgramStageInput,
  type UpdateProgramStageInput,
  type ArchiveProgramStageInput,
  type SetProgramUseStagesInput,
  type AttachGroupStageInput,
  type DetachGroupStageInput,
  type ReorderProgramStagesInput,
} from "@/lib/validation/program-stages";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

async function assertStageInTenant(tenantId: string, stageId: string): Promise<
  | { ok: false; error: string }
  | { ok: true; program_id: string }
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_stages")
    .select("program_id, tenant_id")
    .eq("id", stageId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Stage niet gevonden binnen deze tenant." };
  return { ok: true, program_id: (data as { program_id: string }).program_id };
}

// ── Programma-niveau opt-in ────────────────────────────────

export async function setProgramUseStages(
  input: SetProgramUseStagesInput,
): Promise<ActionResult<{ use_stages: boolean }>> {
  const parsed = setProgramUseStagesSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("programs")
    .update({ use_stages: parsed.data.use_stages })
    .eq("id", parsed.data.program_id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.use_stages.updated",
    meta: {
      program_id: parsed.data.program_id,
      use_stages: parsed.data.use_stages,
    },
  });

  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: { use_stages: parsed.data.use_stages } };
}

// ── Stages CRUD ────────────────────────────────────────────

export async function createProgramStage(
  input: CreateProgramStageInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createProgramStageSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program_stages")
    .insert({
      tenant_id: parsed.data.tenant_id,
      program_id: parsed.data.program_id,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color,
      sort_order: parsed.data.sort_order,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return fail("Een stage met deze naam bestaat al in dit programma.");
    return fail(error?.message ?? "Aanmaken mislukt");
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.stage.created",
    meta: {
      program_id: parsed.data.program_id,
      stage_id: (data as { id: string }).id,
      name: parsed.data.name,
    },
  });

  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateProgramStage(
  input: UpdateProgramStageInput,
): Promise<ActionResult> {
  const parsed = updateProgramStageSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const check = await assertStageInTenant(parsed.data.tenant_id, parsed.data.stage_id);
  if (!check.ok) return fail(check.error);

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.color !== undefined) patch.color = parsed.data.color;
  if (parsed.data.sort_order !== undefined && parsed.data.sort_order !== null) {
    patch.sort_order = parsed.data.sort_order;
  }
  if (Object.keys(patch).length === 0) return { ok: true, data: undefined };

  const supabase = await createClient();
  const { error } = await supabase
    .from("program_stages")
    .update(patch)
    .eq("id", parsed.data.stage_id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) {
    if (error.code === "23505") return fail("Een stage met deze naam bestaat al in dit programma.");
    return fail(error.message);
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.stage.updated",
    meta: {
      program_id: check.program_id,
      stage_id: parsed.data.stage_id,
      patch_keys: Object.keys(patch).join(","),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color ?? null } : {}),
      ...(parsed.data.sort_order !== undefined && parsed.data.sort_order !== null
        ? { sort_order: parsed.data.sort_order }
        : {}),
    },
  });

  revalidatePath(`/tenant/programmas/${check.program_id}`);
  return { ok: true, data: undefined };
}

export async function archiveProgramStage(
  input: ArchiveProgramStageInput,
): Promise<ActionResult> {
  const parsed = archiveProgramStageSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const check = await assertStageInTenant(parsed.data.tenant_id, parsed.data.stage_id);
  if (!check.ok) return fail(check.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("program_stages")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.stage_id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: parsed.data.archived ? "program.stage.archived" : "program.stage.unarchived",
    meta: {
      program_id: check.program_id,
      stage_id: parsed.data.stage_id,
    },
  });

  revalidatePath(`/tenant/programmas/${check.program_id}`);
  return { ok: true, data: undefined };
}

// ── Reorder (Sprint 72 — audit-key `program.stage.reordered`) ─

export async function reorderProgramStages(
  input: ReorderProgramStagesInput,
): Promise<ActionResult> {
  const parsed = reorderProgramStagesSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  // Defense-in-depth: alle stages moeten in tenant + programma zitten.
  const { data: existingRows, error: fetchErr } = await supabase
    .from("program_stages")
    .select("id")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("program_id", parsed.data.program_id)
    .in("id", parsed.data.stage_ids);
  if (fetchErr) return fail(fetchErr.message);
  const existingIds = new Set((existingRows ?? []).map((r) => (r as { id: string }).id));
  for (const id of parsed.data.stage_ids) {
    if (!existingIds.has(id)) {
      return fail("Eén of meer stages horen niet bij dit programma.");
    }
  }

  // Best-effort per-rij update; supabase-js heeft geen multi-statement tx.
  for (let i = 0; i < parsed.data.stage_ids.length; i++) {
    const stageId = parsed.data.stage_ids[i];
    const { error } = await supabase
      .from("program_stages")
      .update({ sort_order: i })
      .eq("id", stageId)
      .eq("tenant_id", parsed.data.tenant_id)
      .eq("program_id", parsed.data.program_id);
    if (error) return fail(error.message);
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.stage.reordered",
    meta: {
      program_id: parsed.data.program_id,
      stage_count: parsed.data.stage_ids.length,
      order: parsed.data.stage_ids.join(","),
    },
  });

  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: undefined };
}

// ── Group ↔ Stage koppeling ────────────────────────────────

export async function attachGroupStage(
  input: AttachGroupStageInput,
): Promise<ActionResult> {
  const parsed = attachGroupStageSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const check = await assertStageInTenant(parsed.data.tenant_id, parsed.data.stage_id);
  if (!check.ok) return fail(check.error);

  // Sprint 72 — defense-in-depth: groep en stage moeten in hetzelfde
  // programma zitten. DB-trigger blokkeert dit ook (23514) maar wij
  // willen een nette gebruikersfout boven een ruwe constraint-error.
  const supabaseCheck = await createClient();
  const { data: groupRow } = await supabaseCheck
    .from("groups")
    .select("program_id")
    .eq("id", parsed.data.group_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  const groupProgramId = (groupRow as { program_id: string | null } | null)?.program_id ?? null;
  if (!groupProgramId) {
    return fail("Groep heeft geen programma — koppel eerst een programma aan deze groep.");
  }
  if (groupProgramId !== check.program_id) {
    return fail("Deze stage hoort bij een ander programma dan deze groep.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("group_stages").insert({
    tenant_id: parsed.data.tenant_id,
    group_id: parsed.data.group_id,
    stage_id: parsed.data.stage_id,
  });
  if (error) {
    if (error.code === "23505") return { ok: true, data: undefined }; // idempotent
    return fail(error.message);
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "group.stage.attached",
    meta: {
      group_id: parsed.data.group_id,
      stage_id: parsed.data.stage_id,
    },
  });

  revalidatePath(`/tenant/groups/${parsed.data.group_id}`);
  return { ok: true, data: undefined };
}

export async function detachGroupStage(
  input: DetachGroupStageInput,
): Promise<ActionResult> {
  const parsed = detachGroupStageSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("group_stages")
    .delete()
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("group_id", parsed.data.group_id)
    .eq("stage_id", parsed.data.stage_id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "group.stage.detached",
    meta: {
      group_id: parsed.data.group_id,
      stage_id: parsed.data.stage_id,
    },
  });

  revalidatePath(`/tenant/groups/${parsed.data.group_id}`);
  return { ok: true, data: undefined };
}
