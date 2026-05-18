"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import { sendNotification } from "@/lib/notifications/send-notification";
import {
  createChildDiplomaSchema,
  updateChildDiplomaSchema,
  type CreateChildDiplomaInput,
  type UpdateChildDiplomaInput,
} from "@/lib/validation/child-diplomas";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const fail = (e: string, fe?: Record<string, string[]>): ActionResult<never> => ({
  ok: false,
  error: e,
  fieldErrors: fe,
});

export async function awardChildDiploma(
  tenantId: string,
  input: CreateChildDiplomaInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createChildDiplomaSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(tenantId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("child_diplomas")
    .insert({
      tenant_id: tenantId,
      member_id: parsed.data.member_id,
      diploma_name: parsed.data.diploma_name,
      level: parsed.data.level ?? null,
      awarded_on: parsed.data.awarded_on,
      awarded_by_member_id: parsed.data.awarded_by_member_id ?? null,
      certificate_url: parsed.data.certificate_url ?? null,
      photo_url: parsed.data.photo_url ?? null,
      notes: parsed.data.notes ?? null,
      created_by_user_id: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Aanmaken mislukt");

  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "child.diploma.awarded",
    meta: {
      diploma_id: data.id,
      member_id: parsed.data.member_id,
      diploma_name: parsed.data.diploma_name,
    },
  });

  // Notify member + parents via member_links reroute (handled by resolve-recipients).
  await sendNotification({
    tenantId,
    title: `Diploma behaald: ${parsed.data.diploma_name}`,
    contentText: parsed.data.level
      ? `Niveau ${parsed.data.level} behaald op ${parsed.data.awarded_on}.`
      : `Toegekend op ${parsed.data.awarded_on}.`,
    source: "child_diploma_awarded",
    sourceRef: data.id,
    createdBy: user.id,
    targets: [{ target_type: "member", target_id: parsed.data.member_id }],
    sendEmail: false,
  }).catch(() => undefined);

  revalidatePath("/tenant/diplomas");
  return { ok: true, data: { id: data.id } };
}

export async function updateChildDiploma(
  tenantId: string,
  input: UpdateChildDiplomaInput,
): Promise<ActionResult<void>> {
  const parsed = updateChildDiplomaSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(tenantId);

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  for (const k of [
    "diploma_name",
    "level",
    "awarded_on",
    "awarded_by_member_id",
    "certificate_url",
    "photo_url",
    "notes",
  ] as const) {
    const v = parsed.data[k];
    if (v !== undefined) patch[k] = v;
  }
  const { error } = await admin
    .from("child_diplomas")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "child.diploma.updated",
    meta: { diploma_id: parsed.data.id },
  });
  revalidatePath("/tenant/diplomas");
  return { ok: true, data: undefined };
}

export async function deleteChildDiploma(
  tenantId: string,
  id: string,
): Promise<ActionResult<void>> {
  const user = await assertTenantAccess(tenantId);
  const admin = createAdminClient();
  const { error } = await admin
    .from("child_diplomas")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "child.diploma.deleted",
    meta: { diploma_id: id },
  });
  revalidatePath("/tenant/diplomas");
  return { ok: true, data: undefined };
}
