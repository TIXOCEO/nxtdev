"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import { sendNotification } from "@/lib/notifications/send-notification";
import {
  createTrainerTaskSchema,
  updateTrainerTaskSchema,
  type CreateTrainerTaskInput,
  type UpdateTrainerTaskInput,
} from "@/lib/validation/trainer-tasks";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const fail = (e: string, fe?: Record<string, string[]>): ActionResult<never> => ({
  ok: false,
  error: e,
  fieldErrors: fe,
});

export async function createTrainerTask(
  tenantId: string,
  input: CreateTrainerTaskInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTrainerTaskSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(tenantId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("trainer_tasks")
    .insert({
      tenant_id: tenantId,
      assigned_to_user_id: parsed.data.assigned_to_user_id,
      created_by_user_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      due_date: parsed.data.due_date ?? null,
      priority: parsed.data.priority,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Aanmaken mislukt");

  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "trainer.task.created",
    meta: { task_id: data.id, assignee: parsed.data.assigned_to_user_id, priority: parsed.data.priority },
  });

  // Notify the assignee.
  await sendNotification({
    tenantId,
    title: `Nieuwe taak: ${parsed.data.title}`,
    contentText: parsed.data.body ?? "Je hebt een nieuwe taak toegewezen gekregen.",
    source: "trainer_task_assigned",
    sourceRef: data.id,
    createdBy: user.id,
    targets: [{ target_type: "user", target_id: parsed.data.assigned_to_user_id }],
    sendEmail: false,
  }).catch(() => undefined);

  revalidatePath("/tenant/taken");
  return { ok: true, data: { id: data.id } };
}

export async function updateTrainerTask(
  tenantId: string,
  input: UpdateTrainerTaskInput,
): Promise<ActionResult<void>> {
  const parsed = updateTrainerTaskSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(tenantId);

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.body !== undefined) patch.body = parsed.data.body;
  if (parsed.data.due_date !== undefined) patch.due_date = parsed.data.due_date;
  if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority;
  if (parsed.data.assigned_to_user_id !== undefined)
    patch.assigned_to_user_id = parsed.data.assigned_to_user_id;
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
    patch.completed_at = parsed.data.status === "done" ? new Date().toISOString() : null;
  }

  const { error } = await admin
    .from("trainer_tasks")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "trainer.task.updated",
    meta: { task_id: parsed.data.id, status: parsed.data.status ?? null },
  });

  revalidatePath("/tenant/taken");
  return { ok: true, data: undefined };
}

export async function setTrainerTaskStatus(
  tenantId: string,
  taskId: string,
  status: "open" | "done" | "cancelled",
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const admin = createAdminClient();

  // Allow assignee OR admin to flip status.
  const { data: existing } = await admin
    .from("trainer_tasks")
    .select("assigned_to_user_id, created_by_user_id")
    .eq("tenant_id", tenantId)
    .eq("id", taskId)
    .maybeSingle();
  if (!existing) return fail("Taak niet gevonden");

  const isOwner =
    existing.assigned_to_user_id === user.id || existing.created_by_user_id === user.id;
  if (!isOwner) {
    // Will throw if not admin.
    await assertTenantAccess(tenantId);
  } else {
    // Belt-and-braces: owners must still be a current tenant member.
    // Prevents ex-trainers (whose user_id remains in old task rows) from flipping status.
    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return fail("Geen toegang tot deze tenant");
  }

  const { error } = await admin
    .from("trainer_tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", taskId);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: `trainer.task.${status}`,
    meta: { task_id: taskId },
  });
  return { ok: true, data: undefined };
}

export async function deleteTrainerTask(
  tenantId: string,
  taskId: string,
): Promise<ActionResult<void>> {
  const user = await assertTenantAccess(tenantId);
  const admin = createAdminClient();
  const { error } = await admin
    .from("trainer_tasks")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", taskId);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "trainer.task.deleted",
    meta: { task_id: taskId },
  });
  revalidatePath("/tenant/taken");
  return { ok: true, data: undefined };
}
