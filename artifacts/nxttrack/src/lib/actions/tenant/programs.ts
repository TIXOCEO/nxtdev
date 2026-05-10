"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import {
  createProgramSchema,
  updateProgramSchema,
  setProgramVisibilitySchema,
  linkProgramGroupSchema,
  unlinkProgramGroupSchema,
  setPrimaryProgramGroupSchema,
  type CreateProgramInput,
  type UpdateProgramInput,
  type SetProgramVisibilityInput,
  type LinkProgramGroupInput,
  type UnlinkProgramGroupInput,
  type SetPrimaryProgramGroupInput,
} from "@/lib/validation/programs";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

async function assertGroupInTenant(tenantId: string, groupId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("groups")
    .select("id")
    .eq("id", groupId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
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

// ─── Program CRUD ───────────────────────────────────────────────
export async function createProgram(
  input: CreateProgramInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createProgramSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .insert({
      tenant_id: parsed.data.tenant_id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      visibility: parsed.data.visibility,
      public_slug: parsed.data.public_slug ?? null,
      default_capacity: parsed.data.default_capacity ?? null,
      default_flex_capacity: parsed.data.default_flex_capacity ?? null,
      default_min_instructors: parsed.data.default_min_instructors,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return fail("Een programma met deze slug bestaat al.");
    return fail(error?.message ?? "Aanmaken mislukt");
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.created",
    meta: {
      program_id: data.id,
      slug: parsed.data.slug,
      visibility: parsed.data.visibility,
    },
  });
  revalidatePath("/tenant/programmas");
  return { ok: true, data };
}

export async function updateProgram(
  input: UpdateProgramInput,
): Promise<ActionResult> {
  const parsed = updateProgramSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertProgramInTenant(parsed.data.tenant_id, parsed.data.id))) {
    return fail("Programma hoort niet bij deze tenant.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("programs")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      public_slug: parsed.data.public_slug ?? null,
      marketing_title: parsed.data.marketing_title ?? null,
      marketing_description: parsed.data.marketing_description ?? null,
      hero_image_url: parsed.data.hero_image_url ?? null,
      cta_label: parsed.data.cta_label ?? null,
      default_capacity: parsed.data.default_capacity ?? null,
      default_flex_capacity: parsed.data.default_flex_capacity ?? null,
      default_min_instructors: parsed.data.default_min_instructors,
      age_min: parsed.data.age_min ?? null,
      age_max: parsed.data.age_max ?? null,
      sort_order: parsed.data.sort_order,
    })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) {
    if (error.code === "23505") return fail("Een programma met deze (publieke) slug bestaat al.");
    return fail(error.message);
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.updated",
    meta: { program_id: parsed.data.id, slug: parsed.data.slug },
  });
  revalidatePath("/tenant/programmas");
  revalidatePath(`/tenant/programmas/${parsed.data.id}`);
  return { ok: true, data: undefined };
}

export async function setProgramVisibility(
  input: SetProgramVisibilityInput,
): Promise<ActionResult> {
  const parsed = setProgramVisibilitySchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertProgramInTenant(parsed.data.tenant_id, parsed.data.id))) {
    return fail("Programma hoort niet bij deze tenant.");
  }

  const supabase = await createClient();
  // Lees current om te checken op public_slug requirement vóór update
  const { data: current } = await supabase
    .from("programs")
    .select("public_slug, visibility")
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!current) return fail("Programma niet gevonden.");

  if (parsed.data.visibility === "public" && !(current as { public_slug: string | null }).public_slug) {
    return fail("Vul eerst een publieke slug in voordat je het programma publiceert.");
  }

  const { error } = await supabase
    .from("programs")
    .update({ visibility: parsed.data.visibility })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return fail(error.message);

  const action =
    parsed.data.visibility === "public"
      ? "program.published"
      : parsed.data.visibility === "archived"
        ? "program.archived"
        : "program.updated";
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action,
    meta: {
      program_id: parsed.data.id,
      visibility: parsed.data.visibility,
      previous_visibility: (current as { visibility: string }).visibility,
    },
  });
  revalidatePath("/tenant/programmas");
  revalidatePath(`/tenant/programmas/${parsed.data.id}`);
  return { ok: true, data: undefined };
}

export async function archiveProgram(
  tenantId: string,
  programId: string,
): Promise<ActionResult> {
  return setProgramVisibility({ tenant_id: tenantId, id: programId, visibility: "archived" });
}

// ─── Program ↔ Group koppeling ──────────────────────────────────
export async function linkGroup(
  input: LinkProgramGroupInput,
): Promise<ActionResult> {
  const parsed = linkProgramGroupSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await assertProgramInTenant(parsed.data.tenant_id, parsed.data.program_id))) {
    return fail("Programma hoort niet bij deze tenant.");
  }
  if (!(await assertGroupInTenant(parsed.data.tenant_id, parsed.data.group_id))) {
    return fail("Groep hoort niet bij deze tenant.");
  }

  const supabase = await createClient();
  // Wanneer is_primary=true: bestaande primary in dit program eerst resetten,
  // anders faalt de partial unique index program_groups_primary_uq.
  if (parsed.data.is_primary) {
    const { error: clrErr } = await supabase
      .from("program_groups")
      .update({ is_primary: false })
      .eq("tenant_id", parsed.data.tenant_id)
      .eq("program_id", parsed.data.program_id)
      .eq("is_primary", true);
    if (clrErr) return fail(clrErr.message);
  }

  const { error } = await supabase
    .from("program_groups")
    .insert({
      tenant_id: parsed.data.tenant_id,
      program_id: parsed.data.program_id,
      group_id: parsed.data.group_id,
      is_primary: parsed.data.is_primary,
    });
  if (error) {
    if (error.code === "23505") return fail("Deze groep is al gekoppeld aan dit programma.");
    return fail(error.message);
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.group.linked",
    meta: {
      program_id: parsed.data.program_id,
      group_id: parsed.data.group_id,
      is_primary: parsed.data.is_primary,
    },
  });
  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  revalidatePath("/tenant/programmas");
  return { ok: true, data: undefined };
}

export async function unlinkGroup(
  input: UnlinkProgramGroupInput,
): Promise<ActionResult> {
  const parsed = unlinkProgramGroupSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("program_groups")
    .delete()
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("program_id", parsed.data.program_id)
    .eq("group_id", parsed.data.group_id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.group.unlinked",
    meta: { program_id: parsed.data.program_id, group_id: parsed.data.group_id },
  });
  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  revalidatePath("/tenant/programmas");
  return { ok: true, data: undefined };
}

export async function setPrimaryGroup(
  input: SetPrimaryProgramGroupInput,
): Promise<ActionResult> {
  const parsed = setPrimaryProgramGroupSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  // Reset huidige primary, dan zet de gekozen groep op primary.
  const { error: clrErr } = await supabase
    .from("program_groups")
    .update({ is_primary: false })
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("program_id", parsed.data.program_id)
    .eq("is_primary", true);
  if (clrErr) return fail(clrErr.message);

  const { error } = await supabase
    .from("program_groups")
    .update({ is_primary: true })
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("program_id", parsed.data.program_id)
    .eq("group_id", parsed.data.group_id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "program.group.linked",
    meta: {
      program_id: parsed.data.program_id,
      group_id: parsed.data.group_id,
      is_primary: true,
      change: "set_primary",
    },
  });
  revalidatePath(`/tenant/programmas/${parsed.data.program_id}`);
  return { ok: true, data: undefined };
}
