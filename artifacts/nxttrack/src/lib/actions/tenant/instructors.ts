"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import {
  availabilitySchema,
  unavailabilitySchema,
  sessionInstructorSchema,
  updateGroupMinInstructorsSchema,
  updateSessionMinInstructorsSchema,
  type AvailabilityInput,
  type UnavailabilityInput,
  type SessionInstructorInput,
  type UpdateGroupMinInstructorsInput,
  type UpdateSessionMinInstructorsInput,
} from "@/lib/validation/instructors";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * Verifieer dat het opgegeven member-id daadwerkelijk binnen de tenant valt.
 * Beschermt tegen cross-tenant inserts via gegokte UUIDs (RLS-aanvulling op
 * de tabel-policies, die alleen tenant_id checken).
 */
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

async function assertSessionInTenant(tenantId: string, sessionId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("training_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
}

// ─── Availability ────────────────────────────────────────────────
export async function createAvailability(
  input: AvailabilityInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertMemberInTenant(parsed.data.tenant_id, parsed.data.member_id))) {
    return fail("Lid hoort niet bij deze tenant.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("instructor_availability")
    .insert({
      tenant_id: parsed.data.tenant_id,
      member_id: parsed.data.member_id,
      day_of_week: parsed.data.day_of_week,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      availability_type: parsed.data.availability_type,
      valid_from: parsed.data.valid_from ?? null,
      valid_until: parsed.data.valid_until ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Aanmaken mislukt");

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: parsed.data.member_id,
    action: "instructor.availability.created",
    meta: {
      day_of_week: parsed.data.day_of_week,
      availability_type: parsed.data.availability_type,
    },
  });
  revalidatePath(`/tenant/instructeurs/${parsed.data.member_id}`);
  return { ok: true, data };
}

export async function deleteAvailability(
  tenantId: string,
  availabilityId: string,
): Promise<ActionResult> {
  const user = await assertTenantAccess(tenantId);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("instructor_availability")
    .select("id, member_id, day_of_week")
    .eq("id", availabilityId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!existing) return fail("Niet gevonden");
  const { error } = await supabase
    .from("instructor_availability")
    .delete()
    .eq("id", availabilityId)
    .eq("tenant_id", tenantId);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    member_id: (existing as { member_id: string }).member_id,
    action: "instructor.availability.deleted",
    meta: { day_of_week: (existing as { day_of_week: number }).day_of_week },
  });
  revalidatePath(`/tenant/instructeurs/${(existing as { member_id: string }).member_id}`);
  return { ok: true, data: undefined };
}

// ─── Unavailability ──────────────────────────────────────────────
export async function createUnavailability(
  input: UnavailabilityInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = unavailabilitySchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertMemberInTenant(parsed.data.tenant_id, parsed.data.member_id))) {
    return fail("Lid hoort niet bij deze tenant.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("instructor_unavailability")
    .insert({
      tenant_id: parsed.data.tenant_id,
      member_id: parsed.data.member_id,
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at,
      reason: parsed.data.reason ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23P01") {
      return fail("Overlapt met een bestaand afwezigheidsblok voor deze instructeur.");
    }
    return fail(error?.message ?? "Aanmaken mislukt");
  }
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: parsed.data.member_id,
    action: "instructor.unavailability.created",
    meta: { reason: parsed.data.reason ?? null },
  });
  revalidatePath(`/tenant/instructeurs/${parsed.data.member_id}`);
  return { ok: true, data };
}

export async function deleteUnavailability(
  tenantId: string,
  unavailabilityId: string,
): Promise<ActionResult> {
  const user = await assertTenantAccess(tenantId);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("instructor_unavailability")
    .select("id, member_id")
    .eq("id", unavailabilityId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!existing) return fail("Niet gevonden");
  const { error } = await supabase
    .from("instructor_unavailability")
    .delete()
    .eq("id", unavailabilityId)
    .eq("tenant_id", tenantId);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    member_id: (existing as { member_id: string }).member_id,
    action: "instructor.unavailability.deleted",
  });
  revalidatePath(`/tenant/instructeurs/${(existing as { member_id: string }).member_id}`);
  return { ok: true, data: undefined };
}

// ─── Session-instructor toewijzingen ─────────────────────────────
export async function assignSessionInstructor(
  input: SessionInstructorInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = sessionInstructorSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertSessionInTenant(parsed.data.tenant_id, parsed.data.session_id))) {
    return fail("Sessie hoort niet bij deze tenant.");
  }
  if (!(await assertMemberInTenant(parsed.data.tenant_id, parsed.data.member_id))) {
    return fail("Lid hoort niet bij deze tenant.");
  }
  if (parsed.data.replaces_member_id) {
    if (!(await assertMemberInTenant(parsed.data.tenant_id, parsed.data.replaces_member_id))) {
      return fail("Vervangen lid hoort niet bij deze tenant.");
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_instructors")
    .insert({
      tenant_id: parsed.data.tenant_id,
      session_id: parsed.data.session_id,
      member_id: parsed.data.member_id,
      assignment_type: parsed.data.assignment_type,
      replaces_member_id: parsed.data.replaces_member_id ?? null,
      assigned_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return fail("Deze instructeur is al toegewezen aan deze sessie.");
    }
    return fail(error?.message ?? "Toewijzen mislukt");
  }
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: parsed.data.member_id,
    action: parsed.data.assignment_type === "substitute"
      ? "instructor.substitute.assigned"
      : "instructor.assignment.added",
    meta: {
      session_id: parsed.data.session_id,
      assignment_type: parsed.data.assignment_type,
      replaces_member_id: parsed.data.replaces_member_id ?? null,
    },
  });
  revalidatePath(`/tenant/trainings/${parsed.data.session_id}`);
  revalidatePath(`/tenant/instructeurs/${parsed.data.member_id}`);
  return { ok: true, data };
}

export async function unassignSessionInstructor(
  tenantId: string,
  assignmentId: string,
): Promise<ActionResult> {
  const user = await assertTenantAccess(tenantId);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("session_instructors")
    .select("id, session_id, member_id, assignment_type")
    .eq("id", assignmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!existing) return fail("Niet gevonden");
  const ex = existing as { session_id: string; member_id: string; assignment_type: string };
  const { error } = await supabase
    .from("session_instructors")
    .delete()
    .eq("id", assignmentId)
    .eq("tenant_id", tenantId);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    member_id: ex.member_id,
    action: "instructor.assignment.removed",
    meta: { session_id: ex.session_id, assignment_type: ex.assignment_type },
  });
  revalidatePath(`/tenant/trainings/${ex.session_id}`);
  revalidatePath(`/tenant/instructeurs/${ex.member_id}`);
  return { ok: true, data: undefined };
}

// ─── Min-instructors ─────────────────────────────────────────────
export async function updateGroupMinInstructors(
  input: UpdateGroupMinInstructorsInput,
): Promise<ActionResult> {
  const parsed = updateGroupMinInstructorsSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({ default_min_instructors: parsed.data.default_min_instructors })
    .eq("id", parsed.data.group_id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "group.default_min_instructors.updated",
    meta: { group_id: parsed.data.group_id, value: parsed.data.default_min_instructors },
  });
  revalidatePath(`/tenant/groups/${parsed.data.group_id}`);
  revalidatePath(`/tenant/planning/onbemand`);
  return { ok: true, data: undefined };
}

export async function updateSessionMinInstructors(
  input: UpdateSessionMinInstructorsInput,
): Promise<ActionResult> {
  const parsed = updateSessionMinInstructorsSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_sessions")
    .update({ min_instructors: parsed.data.min_instructors })
    .eq("id", parsed.data.session_id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "training.min_instructors.updated",
    meta: { session_id: parsed.data.session_id, value: parsed.data.min_instructors },
  });
  revalidatePath(`/tenant/trainings/${parsed.data.session_id}`);
  revalidatePath(`/tenant/planning/onbemand`);
  return { ok: true, data: undefined };
}
