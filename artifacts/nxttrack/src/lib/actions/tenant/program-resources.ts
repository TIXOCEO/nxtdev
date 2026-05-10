"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import {
  addProgramResourceSchema,
  removeProgramResourceSchema,
  type AddProgramResourceInput,
  type RemoveProgramResourceInput,
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

async function assertResourceInTenant(tenantId: string, resourceId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("capacity_resources")
    .select("id")
    .eq("id", resourceId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
}

export async function addProgramResource(
  input: AddProgramResourceInput,
): Promise<ActionResult> {
  const parsed = addProgramResourceSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  if (!(await assertProgramInTenant(parsed.data.tenant_id, parsed.data.program_id))) {
    return fail("Programma hoort niet bij deze tenant.");
  }
  if (!(await assertResourceInTenant(parsed.data.tenant_id, parsed.data.resource_id))) {
    return fail("Resource hoort niet bij deze tenant.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("program_resources")
    .insert({
      tenant_id: parsed.data.tenant_id,
      program_id: parsed.data.program_id,
      resource_id: parsed.data.resource_id,
      max_participants: parsed.data.max_participants,
      notes: parsed.data.notes,
      sort_order: parsed.data.sort_order,
    });
  if (error) {
    if (error.code === "23505") return fail("Deze resource is al gekoppeld aan dit programma.");
    return fail(error.message);
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.resource.added",
    meta: {
      program_id: parsed.data.program_id,
      resource_id: parsed.data.resource_id,
      max_participants: parsed.data.max_participants,
    },
  });
  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: undefined };
}

export async function removeProgramResource(
  input: RemoveProgramResourceInput,
): Promise<ActionResult> {
  const parsed = removeProgramResourceSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("program_resources")
    .delete()
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("program_id", parsed.data.program_id)
    .eq("resource_id", parsed.data.resource_id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.resource.removed",
    meta: {
      program_id: parsed.data.program_id,
      resource_id: parsed.data.resource_id,
    },
  });
  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: undefined };
}
