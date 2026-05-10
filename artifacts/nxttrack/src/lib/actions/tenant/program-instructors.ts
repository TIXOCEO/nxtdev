"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import {
  addProgramInstructorSchema,
  removeProgramInstructorSchema,
  updateProgramInstructorAssignmentSchema,
  type AddProgramInstructorInput,
  type RemoveProgramInstructorInput,
  type UpdateProgramInstructorAssignmentInput,
} from "@/lib/validation/program-planning";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

async function assertProgramInTenant(tenantId: string, programId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("programs")
    .select("id")
    .eq("id", programId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
}

async function assertMemberInTenant(tenantId: string, memberId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
}

/** Sprint 57/61: trainer-rol via member_roles OF tenant_roles.is_trainer_role. */
async function assertMemberHasTrainerRole(
  tenantId: string,
  memberId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const [{ data: directRole }, { data: tenantRole }] = await Promise.all([
    admin
      .from("member_roles")
      .select("member_id")
      .eq("member_id", memberId)
      .eq("role", "trainer")
      .limit(1)
      .maybeSingle(),
    admin
      .from("tenant_member_roles")
      .select("member_id, tenant_roles!inner(is_trainer_role)")
      .eq("tenant_id", tenantId)
      .eq("member_id", memberId)
      .eq("tenant_roles.is_trainer_role", true)
      .limit(1)
      .maybeSingle(),
  ]);
  return Boolean(directRole) || Boolean(tenantRole);
}

export async function addProgramInstructor(
  input: AddProgramInstructorInput,
): Promise<ActionResult> {
  const parsed = addProgramInstructorSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  if (!(await assertProgramInTenant(parsed.data.tenant_id, parsed.data.program_id))) {
    return fail("Programma hoort niet bij deze tenant.");
  }
  if (!(await assertMemberInTenant(parsed.data.tenant_id, parsed.data.member_id))) {
    return fail("Lid hoort niet bij deze tenant.");
  }
  if (!(await assertMemberHasTrainerRole(parsed.data.tenant_id, parsed.data.member_id))) {
    return fail("Dit lid heeft geen trainer-rol en kan niet als programma-instructeur worden toegewezen.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("program_instructors")
    .insert({
      tenant_id: parsed.data.tenant_id,
      program_id: parsed.data.program_id,
      member_id: parsed.data.member_id,
      assignment_type: parsed.data.assignment_type,
      sort_order: parsed.data.sort_order,
    });
  if (error) {
    if (error.code === "23505") return fail("Dit lid is al toegewezen aan dit programma.");
    return fail(error.message);
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: parsed.data.member_id,
    action: "program.instructor.added",
    meta: {
      program_id: parsed.data.program_id,
      assignment_type: parsed.data.assignment_type,
    },
  });
  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: undefined };
}

export async function updateProgramInstructorAssignment(
  input: UpdateProgramInstructorAssignmentInput,
): Promise<ActionResult> {
  const parsed = updateProgramInstructorAssignmentSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("program_instructors")
    .update({ assignment_type: parsed.data.assignment_type })
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("program_id", parsed.data.program_id)
    .eq("member_id", parsed.data.member_id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: parsed.data.member_id,
    action: "program.instructor.updated",
    meta: {
      program_id: parsed.data.program_id,
      assignment_type: parsed.data.assignment_type,
    },
  });
  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: undefined };
}

export async function removeProgramInstructor(
  input: RemoveProgramInstructorInput,
): Promise<ActionResult> {
  const parsed = removeProgramInstructorSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("program_instructors")
    .delete()
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("program_id", parsed.data.program_id)
    .eq("member_id", parsed.data.member_id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: parsed.data.member_id,
    action: "program.instructor.removed",
    meta: { program_id: parsed.data.program_id },
  });
  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: undefined };
}
