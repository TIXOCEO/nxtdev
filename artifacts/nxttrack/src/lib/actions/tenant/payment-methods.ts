"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  type CreatePaymentMethodInput,
  type UpdatePaymentMethodInput,
} from "@/lib/validation/payment-methods";
import type { PaymentMethod } from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(
  error: string,
  fieldErrors?: Record<string, string[] | undefined>,
): ActionResult<never> {
  const cleaned: Record<string, string[]> = {};
  if (fieldErrors) {
    for (const [k, v] of Object.entries(fieldErrors)) {
      if (v) cleaned[k] = v;
    }
  }
  return { ok: false, error, fieldErrors: cleaned };
}

const PATHS = ["/tenant/settings/betaalmogelijkheden", "/tenant/settings"];
function bumpPaths() {
  for (const p of PATHS) revalidatePath(p);
}

export async function createPaymentMethod(
  input: CreatePaymentMethodInput,
): Promise<ActionResult<PaymentMethod>> {
  const parsed = createPaymentMethodSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { tenant_id, ...row } = parsed.data;
  const { data, error } = await supabase
    .from("payment_methods")
    .insert({ tenant_id, ...row })
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon betaalmethode niet aanmaken.");

  await recordAudit({
    tenant_id,
    actor_user_id: user.id,
    action: "payment_method.create",
    meta: { id: (data as PaymentMethod).id, type: row.type },
  });
  bumpPaths();
  return { ok: true, data: data as PaymentMethod };
}

export async function updatePaymentMethod(
  input: UpdatePaymentMethodInput,
): Promise<ActionResult<PaymentMethod>> {
  const parsed = updatePaymentMethodSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { id, tenant_id, ...patch } = parsed.data;
  const { data, error } = await supabase
    .from("payment_methods")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenant_id)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon betaalmethode niet bijwerken.");

  await recordAudit({
    tenant_id,
    actor_user_id: user.id,
    action: "payment_method.update",
    meta: { id, type: patch.type },
  });
  bumpPaths();
  return { ok: true, data: data as PaymentMethod };
}

const archiveSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
});

export async function archivePaymentMethod(
  input: z.infer<typeof archiveSchema>,
): Promise<ActionResult<PaymentMethod>> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon niet archiveren.");
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "payment_method.archive",
    meta: { id: parsed.data.id },
  });
  bumpPaths();
  return { ok: true, data: data as PaymentMethod };
}

export async function unarchivePaymentMethod(
  input: z.infer<typeof archiveSchema>,
): Promise<ActionResult<PaymentMethod>> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .update({ archived_at: null })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon niet dearchiveren.");
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "payment_method.unarchive",
    meta: { id: parsed.data.id },
  });
  bumpPaths();
  return { ok: true, data: data as PaymentMethod };
}
