"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/auth/require-tenant-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPermissionKey } from "@/lib/permissions/catalog";
import { isSuperAdminRole } from "@/lib/roles/is-super-admin";
import type { TenantRoleScope } from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const scopeSchema = z.enum(["admin", "usershell"]);

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).nullable().optional(),
  permissions: z.array(z.string()).default([]),
  sort_order: z.number().int().default(100),
  /** Sprint 22 — alleen relevant bij nieuwe rollen; van bestaande rol niet wijzigbaar. */
  scope: scopeSchema.optional(),
  /** Sprint 22 — alleen geldig voor scope='admin'. */
  is_super_admin: z.boolean().optional(),
});

interface ExistingRoleMin {
  name: string;
  is_system: boolean;
  sort_order: number;
  scope: TenantRoleScope;
  is_super_admin: boolean;
}

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
    const { data: existing } = await admin
      .from("tenant_roles")
      .select("name, is_system, sort_order, scope, is_super_admin")
      .eq("id", roleId)
      .eq("tenant_id", parsed.data.tenant_id)
      .maybeSingle();
    const existingRow = existing as ExistingRoleMin | null;

    if (existingRow && isSuperAdminRole(existingRow)) {
      // Super admin: alleen description bewerkbaar.
      const { error } = await admin
        .from("tenant_roles")
        .update({ description: parsed.data.description ?? null })
        .eq("id", roleId)
        .eq("tenant_id", parsed.data.tenant_id);
      if (error) return { ok: false, error: error.message };

      // Garandeer dat super admin alle huidige permissies heeft.
      await syncSuperAdminPermissions(parsed.data.tenant_id, roleId);
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
    const newScope: TenantRoleScope = parsed.data.scope ?? "admin";
    const newSuperAdmin =
      newScope === "admin" && parsed.data.is_super_admin === true;

    const { data, error } = await admin
      .from("tenant_roles")
      .insert({
        tenant_id: parsed.data.tenant_id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        sort_order: parsed.data.sort_order,
        scope: newScope,
        is_super_admin: newSuperAdmin,
        is_system: false,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    roleId = (data as { id: string }).id;

    if (newSuperAdmin) {
      await syncSuperAdminPermissions(parsed.data.tenant_id, roleId);
      revalidatePath("/tenant/settings/roles");
      return { ok: true, data: { id: roleId } };
    }
  }

  // Replace permissions wholesale (niet voor super admin).
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
  const { data: row } = await admin
    .from("tenant_roles")
    .select("is_system, is_super_admin")
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Rol niet gevonden." };
  const r = row as { is_system: boolean; is_super_admin: boolean };
  if (r.is_super_admin) {
    return { ok: false, error: "Super admin rol kan niet verwijderd worden." };
  }
  if (r.is_system) {
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
 * Sprint 22 — Default systeemrollen.
 *
 *   ADMIN scope (backend / tenant admin shell):
 *     - "Super admin" (is_super_admin=true)
 *     - "Admin" (alle huidige permissies, geen lock)
 *
 *   USERSHELL scope (frontend / user-shell):
 *     - "Athlete", "Minor athlete", "Parent", "Trainer"
 *       Permissiebeheer voor frontend volgt later — deze rollen worden
 *       nu zonder permissies geseed.
 */
const SYSTEM_ROLE_SEEDS: Array<{
  name: string;
  description: string;
  sort_order: number;
  scope: TenantRoleScope;
  is_super_admin: boolean;
  permissions: string[] | "all";
}> = [
  {
    name: "Super admin",
    description: "Volledige toegang tot alle backend acties — niet beperkbaar.",
    sort_order: 0,
    scope: "admin",
    is_super_admin: true,
    permissions: "all",
  },
  {
    name: "Admin",
    description: "Standaard backend admin met alle permissies, aanpasbaar per rol.",
    sort_order: 10,
    scope: "admin",
    is_super_admin: false,
    permissions: "all",
  },
  {
    name: "Athlete",
    description: "Frontend rol voor sporters (volwassen).",
    sort_order: 100,
    scope: "usershell",
    is_super_admin: false,
    permissions: [],
  },
  {
    name: "Minor athlete",
    description: "Frontend rol voor minderjarige sporters.",
    sort_order: 110,
    scope: "usershell",
    is_super_admin: false,
    permissions: [],
  },
  {
    name: "Parent",
    description: "Frontend rol voor ouders / verzorgers.",
    sort_order: 120,
    scope: "usershell",
    is_super_admin: false,
    permissions: [],
  },
  {
    name: "Trainer",
    description: "Frontend rol voor trainers / coaches.",
    sort_order: 130,
    scope: "usershell",
    is_super_admin: false,
    permissions: [],
  },
];

const seedSchema = z.object({ tenant_id: z.string().uuid() });

/** Idempotent: ensure de tenant minimaal de admin- en usershell-systeemrollen heeft. */
export async function seedDefaultRolesIfEmpty(
  input: z.infer<typeof seedSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const admin = createAdminClient();
  const { ALL_PERMISSION_KEYS } = await import("@/lib/permissions/catalog");

  const { data: existing } = await admin
    .from("tenant_roles")
    .select("id, name, scope, is_super_admin, sort_order")
    .eq("tenant_id", input.tenant_id);
  const existingRows = (existing ?? []) as Array<{
    id: string;
    name: string;
    scope: TenantRoleScope;
    is_super_admin: boolean;
    sort_order: number;
  }>;

  // Backwards-compat: pre-sprint22 had alleen "Beheerder" (sort 0). Markeer als super admin.
  const legacyBeheerder = existingRows.find(
    (r) => r.name === "Beheerder" && r.sort_order === 0 && !r.is_super_admin,
  );
  if (legacyBeheerder) {
    await admin
      .from("tenant_roles")
      .update({ is_super_admin: true, scope: "admin" })
      .eq("id", legacyBeheerder.id);
    legacyBeheerder.is_super_admin = true;
    legacyBeheerder.scope = "admin";
  }

  const toInsert = SYSTEM_ROLE_SEEDS.filter(
    (s) => !existingRows.some((e) => e.scope === s.scope && e.name === s.name),
  );

  // Als al een super admin in admin-scope bestaat, sla "Super admin" seed over.
  const haveSuperAdmin = existingRows.some(
    (e) => e.scope === "admin" && e.is_super_admin,
  );
  const toInsertFinal = toInsert.filter(
    (s) => !(s.is_super_admin && haveSuperAdmin),
  );

  if (toInsertFinal.length > 0) {
    const { data: inserted } = await admin
      .from("tenant_roles")
      .insert(
        toInsertFinal.map((s) => ({
          tenant_id: input.tenant_id,
          name: s.name,
          description: s.description,
          is_system: true,
          sort_order: s.sort_order,
          scope: s.scope,
          is_super_admin: s.is_super_admin,
        })),
      )
      .select("id, name, scope");

    const insertedRows = (inserted ?? []) as Array<{
      id: string;
      name: string;
      scope: TenantRoleScope;
    }>;
    const permRows: Array<{ role_id: string; permission: string }> = [];
    for (const seed of toInsertFinal) {
      const row = insertedRows.find(
        (r) => r.name === seed.name && r.scope === seed.scope,
      );
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
  }

  revalidatePath("/tenant/settings/roles");
  return { ok: true, data: undefined };
}

async function syncSuperAdminPermissions(
  tenantId: string,
  roleId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { ALL_PERMISSION_KEYS } = await import("@/lib/permissions/catalog");
  const { data: existing } = await admin
    .from("tenant_role_permissions")
    .select("permission")
    .eq("role_id", roleId);
  const have = new Set(
    ((existing ?? []) as Array<{ permission: string }>).map((r) => r.permission),
  );
  const missing = ALL_PERMISSION_KEYS.filter((k) => !have.has(k));
  if (missing.length === 0) return;
  await admin
    .from("tenant_role_permissions")
    .insert(missing.map((p) => ({ role_id: roleId, permission: p })));
  // tenantId not directly required for the upsert — kept in sig for clarity/future use.
  void tenantId;
}

/**
 * Sprint 22 — Idempotent: zorgt dat alle scope='admin' + is_super_admin rollen
 * voor deze tenant elke permissie uit de huidige catalog hebben.
 */
export async function ensureSuperAdminHasAllPermissions(
  input: z.infer<typeof seedSchema>,
): Promise<ActionResult<void>> {
  await requireTenantAdmin(input.tenant_id);
  const admin = createAdminClient();

  const { data: roles } = await admin
    .from("tenant_roles")
    .select("id")
    .eq("tenant_id", input.tenant_id)
    .eq("is_super_admin", true);

  for (const r of (roles ?? []) as Array<{ id: string }>) {
    await syncSuperAdminPermissions(input.tenant_id, r.id);
  }
  return { ok: true, data: undefined };
}

/** @deprecated Pre-sprint22 alias — gebruik `ensureSuperAdminHasAllPermissions`. */
export const ensureBeheerderHasAllPermissions = ensureSuperAdminHasAllPermissions;
