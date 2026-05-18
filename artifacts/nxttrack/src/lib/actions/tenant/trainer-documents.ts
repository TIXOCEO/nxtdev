"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import {
  createTrainerDocumentSchema,
  updateTrainerDocumentSchema,
  type CreateTrainerDocumentInput,
  type UpdateTrainerDocumentInput,
} from "@/lib/validation/trainer-documents";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const fail = (e: string, fe?: Record<string, string[]>): ActionResult<never> => ({
  ok: false,
  error: e,
  fieldErrors: fe,
});

export async function createTrainerDocument(
  tenantId: string,
  input: CreateTrainerDocumentInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTrainerDocumentSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(tenantId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("trainer_documents")
    .insert({
      tenant_id: tenantId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      file_url: parsed.data.file_url,
      file_type: parsed.data.file_type ?? null,
      category: parsed.data.category,
      uploaded_by_user_id: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Aanmaken mislukt");

  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "trainer.document.created",
    meta: { document_id: data.id, category: parsed.data.category },
  });
  revalidatePath("/tenant/documenten");
  return { ok: true, data: { id: data.id } };
}

export async function updateTrainerDocument(
  tenantId: string,
  input: UpdateTrainerDocumentInput,
): Promise<ActionResult<void>> {
  const parsed = updateTrainerDocumentSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(tenantId);

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "description", "file_url", "file_type", "category", "is_archived"] as const) {
    const v = parsed.data[k];
    if (v !== undefined) patch[k] = v;
  }
  const { error } = await admin
    .from("trainer_documents")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "trainer.document.updated",
    meta: { document_id: parsed.data.id },
  });
  revalidatePath("/tenant/documenten");
  return { ok: true, data: undefined };
}

export async function deleteTrainerDocument(
  tenantId: string,
  id: string,
): Promise<ActionResult<void>> {
  const user = await assertTenantAccess(tenantId);
  const admin = createAdminClient();
  const { error } = await admin
    .from("trainer_documents")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) return fail(error.message);
  await recordAudit({
    tenant_id: tenantId,
    actor_user_id: user.id,
    action: "trainer.document.deleted",
    meta: { document_id: id },
  });
  revalidatePath("/tenant/documenten");
  return { ok: true, data: undefined };
}
