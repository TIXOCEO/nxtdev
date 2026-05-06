"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
  await requireAuth();

  // Autorisatie wordt door RLS afgedwongen
  // (zie sprint27_rls_member_self_parent.sql):
  //   • members.user_id = auth.uid() (self)
  //   • parent via member_links
  //   • user_has_tenant_permission('members.edit')
  const supabase = await createClient();
  const { data, error } = await supabase
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
    .eq("tenant_id", v.tenant_id)
    .select("id");
  if (error) return fail(error.message);
  if (!data || data.length === 0) {
    return fail("Geen rechten om dit profiel te wijzigen.");
  }
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
  await requireAuth();

  // Autorisatie via RLS (zie sprint27_rls_member_self_parent.sql).
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .update({
      player_type: v.player_type || null,
    })
    .eq("id", v.member_id)
    .eq("tenant_id", v.tenant_id)
    .select("id");
  if (error) return fail(error.message);
  if (!data || data.length === 0) {
    return fail("Geen rechten om dit profiel te wijzigen.");
  }
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

  // Server-side belt-and-braces IBAN check (schema already validates).
  if (v.iban && !isValidIban(v.iban)) {
    return fail("Ongeldig IBAN nummer.", {
      iban: ["Ongeldig IBAN nummer."],
    });
  }

  // Autorisatie loopt via RLS (mfd_self_or_admin_modify):
  //   • members.financial.manage permission, OF
  //   • self / parent via user_can_act_for_member.
  const supabase = await createClient();

  // Friendly pre-check op payment_method (de DB-trigger
  // enforce_mfd_tenant_consistency is autoritatief). Sprint 27
  // opende een SELECT-pad voor authenticated tenant-members.
  if (v.payment_method_id) {
    const { data: pm } = await supabase
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
  const { data: upserted, error } = await supabase
    .from("member_financial_details")
    .upsert(
      {
        member_id: v.member_id,
        tenant_id: v.tenant_id,
        iban: ibanValue,
        account_holder_name: v.account_holder_name,
        payment_method_id: v.payment_method_id || null,
      },
      { onConflict: "member_id" },
    )
    .select("member_id");
  if (error) return fail(error.message);
  if (!upserted || upserted.length === 0) {
    return fail("Geen rechten om financiële gegevens te wijzigen.");
  }

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

  // Alle autorisatie + writes lopen via de SECURITY DEFINER RPC
  // public.add_child_as_parent (zie sprint27_rls_member_self_parent.sql).
  // De RPC checkt zelf op auth.uid() of de caller eigenaar is van
  // het parent_member of platform/tenant-admin van de tenant.
  const supabase = await createClient();
  const { data: childId, error } = await supabase.rpc("add_child_as_parent", {
    p_tenant_id: v.tenant_id,
    p_parent_member_id: v.parent_member_id,
    p_first_name: v.first_name,
    p_last_name: v.last_name,
    p_birth_date: v.birth_date ?? null,
    p_gender: v.gender ?? "",
    p_player_type: v.player_type ?? "",
  });
  if (error) {
    // 42501 = insufficient_privilege (parent niet van caller, niet admin,
    // of niet gevonden in tenant). Voor de UI is dat hetzelfde verhaal.
    if (error.code === "42501") {
      return fail("Je mag alleen je eigen kinderen toevoegen.");
    }
    return fail(error.message);
  }
  const childMemberId = (childId as string | null) ?? null;
  if (!childMemberId) return fail("Kon kind niet aanmaken.");

  await recordAudit({
    tenant_id: v.tenant_id,
    actor_user_id: user.id,
    member_id: childMemberId,
    action: "profile.child.add",
  });

  revalidatePath("/t/[slug]/profile", "page");
  return { ok: true, data: { child_member_id: childMemberId } };
}
