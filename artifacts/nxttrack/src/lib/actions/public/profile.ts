"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMemberships } from "@/lib/auth/get-memberships";
import { getAdminRoleTenantIds } from "@/lib/auth/get-admin-role-tenants";
import {
  hasTenantAccess,
  isPlatformAdmin,
  isTenantAdmin,
} from "@/lib/permissions";
import { getUserPermissionsInTenant } from "@/lib/db/tenant-roles";
import { parentCanActForChild } from "@/lib/auth/user-role-rules";
import { isValidIban, maskIban, normalizeIban } from "@/lib/iban";
import { recordAudit } from "@/lib/audit/log";
import {
  updateProfileGeneralSchema,
  updateProfileSportSchema,
  updateFinancialDetailsSchema,
  addChildAsParentSchema,
  revealIbanSchema,
  type UpdateProfileGeneralInput,
  type UpdateProfileSportInput,
  type UpdateFinancialDetailsInput,
  type AddChildAsParentInput,
  type RevealIbanInput,
} from "@/lib/validation/profile";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * Sprint E — gate that allows the action when ANY of the following holds:
 *   1. user owns the member directly (members.user_id = user.id)
 *   2. user is a parent of the member (member_links)
 *   3. user is platform_admin / tenant_admin / has the explicit
 *      permission `members.edit` (or financial-specific perm) for the
 *      tenant.
 *
 * Returns null when allowed, otherwise an error string.
 */
async function assertSelfOrTenantAdmin(opts: {
  tenantId: string;
  memberId: string;
  userId: string;
  permission?: string;
}): Promise<string | null> {
  const { tenantId, memberId, userId, permission } = opts;
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("user_id, tenant_id")
    .eq("id", memberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!member) return "Lid niet gevonden in deze vereniging.";
  if (member.user_id === userId) return null;

  const isParent = await parentCanActForChild(tenantId, userId, memberId);
  if (isParent) return null;

  const [memberships, adminRoleTenants] = await Promise.all([
    getMemberships(userId),
    getAdminRoleTenantIds(userId),
  ]);
  if (
    isPlatformAdmin(memberships) ||
    isTenantAdmin(memberships, tenantId) ||
    (permission &&
      hasTenantAccess(memberships, tenantId, adminRoleTenants) &&
      (await getUserPermissionsInTenant(tenantId, userId)).includes(permission))
  ) {
    return null;
  }
  return "Je hebt geen rechten om dit profiel te wijzigen.";
}

// ── 1. Update General tab fields ──────────────────────────

export async function updateProfileGeneral(
  input: UpdateProfileGeneralInput,
): Promise<ActionResult<{ member_id: string }>> {
  const parsed = updateProfileGeneralSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  }
  const v = parsed.data;
  const user = await requireAuth();
  const denied = await assertSelfOrTenantAdmin({
    tenantId: v.tenant_id,
    memberId: v.member_id,
    userId: user.id,
    permission: "members.edit",
  });
  if (denied) return fail(denied);

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({
      first_name: v.first_name,
      last_name: v.last_name,
      phone: v.phone,
      birth_date: v.birth_date,
      gender: v.gender || null,
      street: v.street,
      house_number: v.house_number,
      postal_code: v.postal_code,
      city: v.city,
    })
    .eq("id", v.member_id)
    .eq("tenant_id", v.tenant_id);
  if (error) return fail(error.message);
  revalidatePath("/t/[slug]/profile", "page");
  return { ok: true, data: { member_id: v.member_id } };
}

// ── 2. Update Sport tab (player_type) ─────────────────────

export async function updateProfileSport(
  input: UpdateProfileSportInput,
): Promise<ActionResult<{ member_id: string }>> {
  const parsed = updateProfileSportSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  }
  const v = parsed.data;
  const user = await requireAuth();
  const denied = await assertSelfOrTenantAdmin({
    tenantId: v.tenant_id,
    memberId: v.member_id,
    userId: user.id,
    permission: "members.edit",
  });
  if (denied) return fail(denied);

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({
      player_type: v.player_type || null,
    })
    .eq("id", v.member_id)
    .eq("tenant_id", v.tenant_id);
  if (error) return fail(error.message);
  revalidatePath("/t/[slug]/profile", "page");
  return { ok: true, data: { member_id: v.member_id } };
}

// ── 3. Update Financial tab (IBAN + payment method) ──────

export async function updateFinancialDetails(
  input: UpdateFinancialDetailsInput,
): Promise<ActionResult<{ iban_masked: string | null }>> {
  const parsed = updateFinancialDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  }
  const v = parsed.data;
  const user = await requireAuth();
  const denied = await assertSelfOrTenantAdmin({
    tenantId: v.tenant_id,
    memberId: v.member_id,
    userId: user.id,
    permission: "members.financial.manage",
  });
  if (denied) return fail(denied);

  // Server-side belt-and-braces IBAN check (schema already validates).
  if (v.iban && !isValidIban(v.iban)) {
    return fail("Ongeldig IBAN nummer.", {
      iban: ["Ongeldig IBAN nummer."],
    });
  }

  // Validate payment_method_id belongs to the same tenant before write
  // (DB trigger also enforces this — we double-check for a friendlier
  // error message).
  const admin = createAdminClient();
  if (v.payment_method_id) {
    const { data: pm } = await admin
      .from("payment_methods")
      .select("id, tenant_id, archived_at")
      .eq("id", v.payment_method_id)
      .maybeSingle();
    if (!pm || pm.tenant_id !== v.tenant_id) {
      return fail("Ongeldige betaalmethode.");
    }
    if (pm.archived_at) {
      return fail("Deze betaalmethode is gearchiveerd.");
    }
  }

  const ibanValue = v.iban ? normalizeIban(v.iban) : null;
  const { error } = await admin.from("member_financial_details").upsert(
    {
      member_id: v.member_id,
      tenant_id: v.tenant_id,
      iban: ibanValue,
      account_holder_name: v.account_holder_name,
      payment_method_id: v.payment_method_id || null,
    },
    { onConflict: "member_id" },
  );
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: v.tenant_id,
    actor_user_id: user.id,
    member_id: v.member_id,
    action: "financial.update",
    meta: {
      has_iban: !!ibanValue,
      payment_method_id: v.payment_method_id || null,
    },
  });

  revalidatePath("/t/[slug]/profile", "page");
  return {
    ok: true,
    data: { iban_masked: ibanValue ? maskIban(ibanValue) : null },
  };
}

// ── 4. Reveal raw IBAN (audit-logged) ─────────────────────

export async function revealMemberIban(
  input: RevealIbanInput,
): Promise<ActionResult<{ iban: string | null; iban_masked: string | null }>> {
  const parsed = revealIbanSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer");
  const v = parsed.data;
  const user = await requireAuth();
  const denied = await assertSelfOrTenantAdmin({
    tenantId: v.tenant_id,
    memberId: v.member_id,
    userId: user.id,
    permission: "members.financial.view",
  });
  if (denied) return fail(denied);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_financial_details")
    .select("iban")
    .eq("member_id", v.member_id)
    .eq("tenant_id", v.tenant_id)
    .maybeSingle();
  if (error) return fail(error.message);

  const iban = (data?.iban as string | null) ?? null;
  await recordAudit({
    tenant_id: v.tenant_id,
    actor_user_id: user.id,
    member_id: v.member_id,
    action: "financial.iban.reveal",
    meta: { had_value: !!iban },
  });
  return {
    ok: true,
    data: { iban, iban_masked: iban ? maskIban(iban) : null },
  };
}

// ── 5. Add child as parent (no invite) ────────────────────

export async function addChildAsParent(
  input: AddChildAsParentInput,
): Promise<ActionResult<{ child_member_id: string }>> {
  const parsed = addChildAsParentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);
  }
  const v = parsed.data;
  const user = await requireAuth();

  // The parent member must belong to the calling user.
  const admin = createAdminClient();
  const { data: parent } = await admin
    .from("members")
    .select("id, user_id, tenant_id")
    .eq("id", v.parent_member_id)
    .eq("tenant_id", v.tenant_id)
    .maybeSingle();
  if (!parent) return fail("Ouderlid niet gevonden in deze vereniging.");
  if (parent.user_id !== user.id) {
    // Only platform/tenant admins kunnen dit voor iemand anders doen.
    const memberships = await getMemberships(user.id);
    if (!isPlatformAdmin(memberships) && !isTenantAdmin(memberships, v.tenant_id)) {
      return fail("Alleen je eigen kinderen kun je toevoegen.");
    }
  }

  const fullName = `${v.first_name} ${v.last_name}`.trim();

  // Idempotency: als ouder al een gekoppeld kind heeft met exact dezelfde
  // first_name/last_name/birth_date in deze tenant, geef dat kind terug
  // i.p.v. een tweede record aan te maken (voorkomt dubbele clicks /
  // herhaalde submits).
  const { data: existingLinks } = await admin
    .from("member_links")
    .select("child_member_id")
    .eq("tenant_id", v.tenant_id)
    .eq("parent_member_id", v.parent_member_id);
  const linkedChildIds = ((existingLinks ?? []) as Array<{ child_member_id: string }>).map(
    (l) => l.child_member_id,
  );
  if (linkedChildIds.length > 0) {
    const { data: dupes } = await admin
      .from("members")
      .select("id, first_name, last_name, birth_date")
      .in("id", linkedChildIds)
      .eq("tenant_id", v.tenant_id);
    const dupe = ((dupes ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      birth_date: string | null;
    }>).find(
      (d) =>
        (d.first_name ?? "").toLowerCase() === v.first_name.toLowerCase() &&
        (d.last_name ?? "").toLowerCase() === v.last_name.toLowerCase() &&
        (d.birth_date ?? null) === (v.birth_date ?? null),
    );
    if (dupe) {
      return { ok: true, data: { child_member_id: dupe.id } };
    }
  }

  const { data: childRow, error: insertErr } = await admin
    .from("members")
    .insert({
      tenant_id: v.tenant_id,
      full_name: fullName,
      first_name: v.first_name,
      last_name: v.last_name,
      birth_date: v.birth_date,
      gender: v.gender || null,
      player_type: v.player_type || null,
      account_type: "minor_athlete",
      member_status: "aspirant",
    })
    .select("id")
    .single();
  if (insertErr || !childRow) {
    return fail(insertErr?.message ?? "Kon kind niet aanmaken.");
  }

  // Geef het kind de athlete-rol (voor consistentie met Sprint C).
  await admin
    .from("member_roles")
    .insert({ member_id: childRow.id, role: "athlete" });

  // Link parent ↔ child.
  const { error: linkErr } = await admin.from("member_links").insert({
    tenant_id: v.tenant_id,
    parent_member_id: v.parent_member_id,
    child_member_id: childRow.id,
  });
  if (linkErr && linkErr.code !== "23505") {
    return fail(linkErr.message);
  }

  await recordAudit({
    tenant_id: v.tenant_id,
    actor_user_id: user.id,
    member_id: childRow.id,
    action: "profile.child.add",
  });

  revalidatePath("/t/[slug]/profile", "page");
  return { ok: true, data: { child_member_id: childRow.id } };
}
