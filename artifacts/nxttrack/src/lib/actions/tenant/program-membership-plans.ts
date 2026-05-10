"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import {
  linkProgramMembershipPlanSchema,
  unlinkProgramMembershipPlanSchema,
  setProgramMembershipPlanDefaultSchema,
  type LinkProgramMembershipPlanInput,
  type UnlinkProgramMembershipPlanInput,
  type SetProgramMembershipPlanDefaultInput,
} from "@/lib/validation/program-membership-plans";

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

async function assertPlanInTenant(tenantId: string, planId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("membership_plans")
    .select("id")
    .eq("id", planId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
}

export async function linkProgramMembershipPlan(
  input: LinkProgramMembershipPlanInput,
): Promise<ActionResult> {
  const parsed = linkProgramMembershipPlanSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  if (!(await assertProgramInTenant(parsed.data.tenant_id, parsed.data.program_id))) {
    return fail("Programma hoort niet bij deze tenant.");
  }
  if (!(await assertPlanInTenant(parsed.data.tenant_id, parsed.data.membership_plan_id))) {
    return fail("Lidmaatschapsplan hoort niet bij deze tenant.");
  }

  const supabase = await createClient();

  // Insert ALTIJD met is_default=false zodat een falende insert nooit de
  // bestaande default-rij ongedaan maakt. Default-switch gebeurt daarna
  // via één atomische RPC (single UPDATE statement).
  const { error } = await supabase
    .from("program_membership_plans")
    .insert({
      tenant_id: parsed.data.tenant_id,
      program_id: parsed.data.program_id,
      membership_plan_id: parsed.data.membership_plan_id,
      is_default: false,
      sort_order: parsed.data.sort_order,
    });
  if (error) {
    if (error.code === "23505") return fail("Dit plan is al gekoppeld aan dit programma.");
    return fail(error.message);
  }

  if (parsed.data.is_default) {
    const { data: switched, error: swErr } = await supabase.rpc(
      "set_program_default_plan",
      {
        p_tenant: parsed.data.tenant_id,
        p_program: parsed.data.program_id,
        p_plan: parsed.data.membership_plan_id,
      },
    );
    if (swErr || switched !== true) {
      return fail(swErr?.message ?? "Kon plan niet als standaard markeren.");
    }
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.membership_plan.linked",
    meta: {
      program_id: parsed.data.program_id,
      membership_plan_id: parsed.data.membership_plan_id,
      is_default: parsed.data.is_default,
    },
  });
  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: undefined };
}

export async function unlinkProgramMembershipPlan(
  input: UnlinkProgramMembershipPlanInput,
): Promise<ActionResult> {
  const parsed = unlinkProgramMembershipPlanSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("program_membership_plans")
    .delete()
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("program_id", parsed.data.program_id)
    .eq("membership_plan_id", parsed.data.membership_plan_id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.membership_plan.unlinked",
    meta: {
      program_id: parsed.data.program_id,
      membership_plan_id: parsed.data.membership_plan_id,
    },
  });
  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: undefined };
}

export async function setProgramMembershipPlanDefault(
  input: SetProgramMembershipPlanDefaultInput,
): Promise<ActionResult> {
  const parsed = setProgramMembershipPlanDefaultSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();

  // Atomisch: één UPDATE-statement zet target=true en alle andere=false.
  // Voorkomt dat een falende tweede stap defaults ongewenst uitschakelt.
  const { data: switched, error: swErr } = await supabase.rpc(
    "set_program_default_plan",
    {
      p_tenant: parsed.data.tenant_id,
      p_program: parsed.data.program_id,
      p_plan: parsed.data.membership_plan_id,
    },
  );
  if (swErr) return fail(swErr.message);
  if (switched !== true) return fail("Koppeling niet gevonden.");

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.membership_plan.set_default",
    meta: {
      program_id: parsed.data.program_id,
      membership_plan_id: parsed.data.membership_plan_id,
    },
  });
  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: undefined };
}
