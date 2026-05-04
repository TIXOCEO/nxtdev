"use server";

import { revalidatePath } from "next/cache";
import { assertTenantAccess } from "./_assert-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAlertSchema, updateAlertSchema } from "@/lib/validation/alerts";
import type { z } from "zod";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidate() {
  revalidatePath("/tenant/communication/alerts");
  revalidatePath("/t", "layout");
}

export async function createAlert(
  input: z.infer<typeof createAlertSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAlertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldig" };
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("alerts")
    .insert({
      tenant_id: parsed.data.tenant_id,
      title: parsed.data.title,
      content: parsed.data.content ?? null,
      type: parsed.data.type,
      is_active: parsed.data.is_active,
      start_at: parsed.data.start_at ?? null,
      end_at: parsed.data.end_at ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert mislukt" };
  revalidate();
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateAlert(
  input: z.infer<typeof updateAlertSchema>,
): Promise<ActionResult<void>> {
  const parsed = updateAlertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldig" };
  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();
  const { id, tenant_id, ...rest } = parsed.data;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) patch[k] = v;
  }
  patch.updated_at = new Date().toISOString();
  const { error } = await admin
    .from("alerts")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: undefined };
}

export async function deleteAlert(input: {
  tenant_id: string;
  id: string;
}): Promise<ActionResult<void>> {
  await assertTenantAccess(input.tenant_id);
  const admin = createAdminClient();
  const { error } = await admin
    .from("alerts")
    .delete()
    .eq("id", input.id)
    .eq("tenant_id", input.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: undefined };
}

export async function toggleAlertActive(input: {
  tenant_id: string;
  id: string;
  is_active: boolean;
}): Promise<ActionResult<void>> {
  await assertTenantAccess(input.tenant_id);
  const admin = createAdminClient();
  const { error } = await admin
    .from("alerts")
    .update({ is_active: input.is_active, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("tenant_id", input.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: undefined };
}
