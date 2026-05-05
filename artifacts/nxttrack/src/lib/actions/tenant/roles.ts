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
    // Bescherm de super admin: naam, sort en permissies van Beheerder
    // (sort_order 0, system) mogen niet via de UI worden aangepast.
    const { data: existing } = await admin
      .from("tenant_roles")
      .select("name, is_system, sort_order")
      .eq("id", roleId)
      .eq("tenant_id", parsed.data.tenant_id)
      .maybeSingle();
    if (existing && isSuperAdminRole(existing as { name: string; is_system: boolean; sort_order: number })) {
      // Sta alleen description-aanpassingen toe.
      const { error } = await admin
        .from("tenant_roles")
        .update({ description: parsed.data.description ?? null })
        .eq("id", roleId)
        .eq("tenant_id", parsed.data.tenant_id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/tenant/settings/roles");
      return { ok: true, data: { id: roleId } };
    }

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

/**
 * Default permissie-sets per system role. Beheerder krijgt ALLE permissies
 * via `ensureBeheerderHasAllPermissions` zodat nieuwe keys in de catalog
 * automatisch meegroeien.
 */
const TRAINER_PERMS = [
  "members.view",
  "trainings.view",
  "trainings.create",
  "trainings.edit",
  "attendance.mark",
  "news.publish",
  "news.edit",
  "social.view",
  "social.post",
  "social.comment",
  "social.like",
  "social.broadcast",
  "messages.use",
  "messages.broadcast",
];

const COACH_PERMS = [
  "members.view",
  "trainings.view",
  "attendance.mark",
  "social.view",
  "social.post",
  "social.comment",
  "social.like",
  "messages.use",
];

const OUDER_PERMS = [
  "social.view",
  "social.comment",
  "social.like",
  "messages.use",
];

const SYSTEM_ROLE_SEEDS: Array<{
  name: string;
  description: string;
  sort_order: number;
  permissions: string[] | "all";
}> = [
  {
    name: "Beheerder",
    description: "Volledige toegang tot alle tenant-acties (super admin).",
    sort_order: 0,
    permissions: "all",
  },
  {
    name: "Trainer",
    description: "Beheert trainingen, aanwezigheid en communicatie met spelers.",
    sort_order: 10,
    permissions: TRAINER_PERMS,
  },
  {
    name: "Coach",
    description: "Bekijkt leden, markeert aanwezigheid en gebruikt de social feed.",
    sort_order: 20,
    permissions: COACH_PERMS,
  },
  {
    name: "Ouder",
    description: "Bekijkt de social feed en kan berichten gebruiken.",
    sort_order: 30,
    permissions: OUDER_PERMS,
  },
  {
    name: "Lid",
    description: "Standaard rol voor leden zonder bijzondere permissies.",
    sort_order: 100,
    permissions: [],
  },
];

/** True voor de "super admin"-systeemrol (Beheerder met sort_order 0). */
export function isSuperAdminRole(role: {
  name: string;
  is_system: boolean;
  sort_order: number;
}): boolean {
  return role.is_system && role.sort_order === 0 && role.name === "Beheerder";
}

const seedSchema = z.object({ tenant_id: z.string().uuid() });
/**
 * Idempotent: ensures the tenant has Beheerder, Trainer, Coach, Ouder en Lid
 * system roles if no roles exist. Called when the roles page is first opened.
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

  const { ALL_PERMISSION_KEYS } = await import("@/lib/permissions/catalog");

  const { data: inserted } = await admin
    .from("tenant_roles")
    .insert(
      SYSTEM_ROLE_SEEDS.map((s) => ({
        tenant_id: input.tenant_id,
        name: s.name,
        description: s.description,
        is_system: true,
        sort_order: s.sort_order,
      })),
    )
    .select("id, name");

  const insertedRows = (inserted ?? []) as Array<{ id: string; name: string }>;
  const permRows: Array<{ role_id: string; permission: string }> = [];
  for (const seed of SYSTEM_ROLE_SEEDS) {
    const row = insertedRows.find((r) => r.name === seed.name);
    if (!row) continue;
    const keys = seed.permissions === "all" ? ALL_PERMISSION_KEYS : seed.permissions;
    for (const k of keys) {
      if (ALL_PERMISSION_KEYS.includes(k)) {
        permRows.push({ role_id: row.id, permission: k });
      }
    }
  }
  if (permRows.length > 0) {
    await admin.from("tenant_role_permissions").insert(permRows);
  }
  revalidatePath("/tenant/settings/roles");
  return { ok: true, data: undefined };
}

/**
 * Idempotent: zorgt dat de "Beheerder" systeemrol elke permissie uit de
 * huidige catalog heeft. Wordt bij elke load van de rollenpagina aangeroepen
 * zodat nieuwe permissies automatisch beschikbaar zijn voor de super admin.
 */
export async function ensureBeheerderHasAllPermissions(
  input: z.infer<typeof seedSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const admin = createAdminClient();

  const { data: roleRow } = await admin
    .from("tenant_roles")
    .select("id, name, is_system, sort_order")
    .eq("tenant_id", input.tenant_id)
    .eq("is_system", true)
    .eq("sort_order", 0)
    .eq("name", "Beheerder")
    .maybeSingle();

  if (!roleRow) return { ok: true, data: undefined };
  const roleId = (roleRow as { id: string }).id;

  const { ALL_PERMISSION_KEYS } = await import("@/lib/permissions/catalog");
  const { data: existing } = await admin
    .from("tenant_role_permissions")
    .select("permission")
    .eq("role_id", roleId);

  const have = new Set(((existing ?? []) as Array<{ permission: string }>).map((r) => r.permission));
  const missing = ALL_PERMISSION_KEYS.filter((k) => !have.has(k));
  if (missing.length === 0) return { ok: true, data: undefined };

  const rows = missing.map((p) => ({ role_id: roleId, permission: p }));
  await admin.from("tenant_role_permissions").insert(rows);
  return { ok: true, data: undefined };
}
