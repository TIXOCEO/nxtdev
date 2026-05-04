"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPermissionKey } from "@/lib/permissions/catalog";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).nullable().optional(),
  permissions: z.array(z.string()).default([]),
  sort_order: z.number().int().default(0),
});

export async function upsertTenantRole(
  input: z.infer<typeof upsertSchema>,
): Promise<ActionResult<{ id: string }>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const cleanPerms = Array.from(new Set(parsed.data.permissions.filter(isValidPermissionKey)));
  const admin = createAdminClient();

  let roleId = parsed.data.id;
  if (roleId) {
    const { error } = await admin
      .from("tenant_roles")
      .update({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        sort_order: parsed.data.sort_order,
      })
      .eq("id", roleId)
      .eq("tenant_id", parsed.data.tenant_id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await admin
      .from("tenant_roles")
      .insert({
        tenant_id: parsed.data.tenant_id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        sort_order: parsed.data.sort_order,
        is_system: false,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    roleId = (data as { id: string }).id;
  }

  // Replace permissions wholesale.
  await admin.from("tenant_role_permissions").delete().eq("role_id", roleId);
  if (cleanPerms.length > 0) {
    const rows = cleanPerms.map((p) => ({ role_id: roleId, permission: p }));
    const { error } = await admin.from("tenant_role_permissions").insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/tenant/settings/roles");
  return { ok: true, data: { id: roleId } };
}

const deleteSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
});
export async function deleteTenantRole(
  input: z.infer<typeof deleteSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige id" };
  const admin = createAdminClient();
  // System roles are protected.
  const { data: row } = await admin
    .from("tenant_roles")
    .select("is_system")
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Rol niet gevonden." };
  if ((row as { is_system: boolean }).is_system) {
    return { ok: false, error: "Systeemrol kan niet verwijderd worden." };
  }
  const { error } = await admin
    .from("tenant_roles")
    .delete()
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tenant/settings/roles");
  return { ok: true, data: undefined };
}

const assignSchema = z.object({
  tenant_id: z.string().uuid(),
  member_id: z.string().uuid(),
  role_ids: z.array(z.string().uuid()),
});
export async function setMemberRoles(
  input: z.infer<typeof assignSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const admin = createAdminClient();
  await admin
    .from("tenant_member_roles")
    .delete()
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("member_id", parsed.data.member_id);
  if (parsed.data.role_ids.length > 0) {
    const rows = parsed.data.role_ids.map((rid) => ({
      tenant_id: parsed.data.tenant_id,
      member_id: parsed.data.member_id,
      role_id: rid,
    }));
    const { error } = await admin.from("tenant_member_roles").insert(rows);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/tenant/settings/roles");
  revalidatePath("/tenant/members");
  return { ok: true, data: undefined };
}

const seedSchema = z.object({ tenant_id: z.string().uuid() });
/**
 * Idempotent: ensures the tenant has a "Beheerder" and "Lid" system role
 * if no roles exist. Called when the roles page is first opened.
 */
export async function seedDefaultRolesIfEmpty(
  input: z.infer<typeof seedSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("tenant_roles")
    .select("id")
    .eq("tenant_id", input.tenant_id)
    .limit(1);
  if ((existing ?? []).length > 0) return { ok: true, data: undefined };

  const { data: inserted } = await admin
    .from("tenant_roles")
    .insert([
      {
        tenant_id: input.tenant_id,
        name: "Beheerder",
        description: "Volledige toegang tot alle tenant-acties.",
        is_system: true,
        sort_order: 0,
      },
      {
        tenant_id: input.tenant_id,
        name: "Lid",
        description: "Standaard rol voor leden zonder bijzondere permissies.",
        is_system: true,
        sort_order: 100,
      },
    ])
    .select("id, name");

  const beheerder = ((inserted ?? []) as Array<{ id: string; name: string }>).find(
    (r) => r.name === "Beheerder",
  );
  if (beheerder) {
    // Grant Beheerder all current permissions.
    const { ALL_PERMISSION_KEYS } = await import("@/lib/permissions/catalog");
    const rows = ALL_PERMISSION_KEYS.map((p) => ({
      role_id: beheerder.id,
      permission: p,
    }));
    if (rows.length > 0) {
      await admin.from("tenant_role_permissions").insert(rows);
    }
  }
  revalidatePath("/tenant/settings/roles");
  return { ok: true, data: undefined };
}
