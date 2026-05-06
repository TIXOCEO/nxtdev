"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import {
  createPaymentSchema,
  updatePaymentSchema,
  deletePaymentSchema,
  endMembershipSchema,
  setDefaultPlanSchema,
  setDefaultPaymentMethodSchema,
  deriveStatus,
  type CreatePaymentInput,
  type UpdatePaymentInput,
  type DeletePaymentInput,
  type EndMembershipInput,
} from "@/lib/validation/payments";
import type {
  MembershipPaymentLog,
  MemberMembership,
  MembershipPlan,
  PaymentMethod,
} from "@/types/database";

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

async function recordPaymentAudit(opts: {
  payment_id: string;
  tenant_id: string;
  actor_user_id: string;
  action: "updated" | "deleted";
  note: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("membership_payment_audit").insert({
      payment_id: opts.payment_id,
      tenant_id: opts.tenant_id,
      actor_user_id: opts.actor_user_id,
      action: opts.action,
      note: opts.note,
      before: opts.before ?? null,
      after: opts.after ?? null,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[payment_audit] insert failed:", error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[payment_audit] unexpected error:",
      err instanceof Error ? err.message : err,
    );
  }
}

async function loadMembershipForTenant(
  tenantId: string,
  memberMembershipId: string,
): Promise<{ id: string; member_id: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_memberships")
    .select("id, member_id, members!inner(tenant_id)")
    .eq("id", memberMembershipId)
    .eq("members.tenant_id", tenantId)
    .maybeSingle();
  return (data as { id: string; member_id: string } | null) ?? null;
}

/**
 * Sprint 30 — Bewaakt dat alle optionele FK-verwijzingen op een
 * payment-rij bij dezelfde tenant horen. Voorkomt cross-tenant lekkage
 * via een vervalste payload (bv. een plan-id van een andere club).
 * Geeft een foutmelding terug als één van de IDs niet matcht.
 */
async function validatePaymentRefsForTenant(
  tenantId: string,
  refs: {
    membership_plan_id?: string | null;
    paid_via_payment_method_id?: string | null;
    parent_payment_id?: string | null;
  },
): Promise<string | null> {
  const supabase = await createClient();

  if (refs.membership_plan_id) {
    const { data } = await supabase
      .from("membership_plans")
      .select("id")
      .eq("id", refs.membership_plan_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!data) return "Abonnement hoort niet bij deze club.";
  }

  if (refs.paid_via_payment_method_id) {
    const { data } = await supabase
      .from("payment_methods")
      .select("id, archived_at")
      .eq("id", refs.paid_via_payment_method_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!data) return "Betaalmethode hoort niet bij deze club.";
    if ((data as { archived_at: string | null }).archived_at) {
      return "Betaalmethode is gearchiveerd.";
    }
  }

  if (refs.parent_payment_id) {
    // Parent moet via member_memberships → members.tenant_id matchen.
    const { data } = await supabase
      .from("membership_payment_logs")
      .select(
        "id, member_memberships!inner(members!inner(tenant_id))",
      )
      .eq("id", refs.parent_payment_id)
      .maybeSingle();
    const tid = (
      data as
        | { member_memberships: { members: { tenant_id: string } } }
        | null
    )?.member_memberships?.members?.tenant_id;
    if (!data || tid !== tenantId) {
      return "Bron-betaling hoort niet bij deze club.";
    }
  }

  return null;
}

// ── 1. Defaults: plan & methode ───────────────────────────

export async function setDefaultMembershipPlan(
  input: z.infer<typeof setDefaultPlanSchema>,
): Promise<ActionResult<void>> {
  const parsed = setDefaultPlanSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  // Atomair: één plpgsql-functie clear+set in één transactie zodat we
  // nooit met "geen default" achterblijven als de set zou falen. De
  // functie valideert ook tenant + is_active.
  const { error: rpcErr } = await supabase.rpc("set_membership_plan_default", {
    p_tenant_id: parsed.data.tenant_id,
    p_plan_id: parsed.data.id,
  });
  if (rpcErr) return fail(rpcErr.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "membership_plan.set_default",
    meta: { plan_id: parsed.data.id },
  });

  revalidatePath("/tenant/memberships");
  return { ok: true, data: undefined };
}

export async function setDefaultPaymentMethod(
  input: z.infer<typeof setDefaultPaymentMethodSchema>,
): Promise<ActionResult<void>> {
  const parsed = setDefaultPaymentMethodSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  // Zelfde atomaire patroon als bij plan-default.
  const { error: rpcErr } = await supabase.rpc("set_payment_method_default", {
    p_tenant_id: parsed.data.tenant_id,
    p_method_id: parsed.data.id,
  });
  if (rpcErr) return fail(rpcErr.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "payment_method.set_default",
    meta: { payment_method_id: parsed.data.id },
  });

  revalidatePath("/tenant/settings/betaalmogelijkheden");
  return { ok: true, data: undefined };
}

// ── 2. CRUD: betaling ─────────────────────────────────────

function paymentRowFromInput(input: CreatePaymentInput | UpdatePaymentInput) {
  const expected = input.amount_expected ?? null;
  const paid = input.amount_paid ?? null;
  const status = deriveStatus({
    amount_paid: paid as number | null,
    amount_expected: expected as number | null,
  });
  return {
    member_membership_id: input.member_membership_id,
    membership_plan_id: input.membership_plan_id ?? null,
    paid_via_payment_method_id: input.paid_via_payment_method_id ?? null,
    amount_expected: expected,
    amount_paid: paid,
    // Houd legacy `amount` consistent zodat oude views (zonder restant-kolom)
    // het bedrag nog kunnen tonen.
    amount: paid ?? expected,
    period: input.period ?? null,
    paid_at: input.paid_at ?? null,
    due_date: input.due_date ?? null,
    parent_payment_id: input.parent_payment_id ?? null,
    note: input.note ?? null,
    status,
  };
}

export async function createMembershipPayment(
  input: CreatePaymentInput,
): Promise<ActionResult<MembershipPaymentLog>> {
  const parsed = createPaymentSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const mm = await loadMembershipForTenant(
    parsed.data.tenant_id,
    parsed.data.member_membership_id,
  );
  if (!mm) return fail("Abonnement niet gevonden.");

  const refErr = await validatePaymentRefsForTenant(parsed.data.tenant_id, {
    membership_plan_id: parsed.data.membership_plan_id,
    paid_via_payment_method_id: parsed.data.paid_via_payment_method_id,
    parent_payment_id: parsed.data.parent_payment_id,
  });
  if (refErr) return fail(refErr);

  const supabase = await createClient();
  const row = paymentRowFromInput(parsed.data);
  const { data, error } = await supabase
    .from("membership_payment_logs")
    .insert(row)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon betaling niet aanmaken.");

  // Wanneer dit een restant-boeking is en de oorspronkelijke regel daardoor
  // volledig betaald wordt, markeer die als 'paid'.
  if (parsed.data.parent_payment_id) {
    await recalculateParentPayment(parsed.data.parent_payment_id);
  }

  revalidatePath(`/tenant/members/${mm.member_id}`);
  return { ok: true, data: data as MembershipPaymentLog };
}

/**
 * Sprint 30 — Wanneer er restant-boekingen aan een parent hangen:
 *   - Bewaar de oorspronkelijke deelbetaling in `original_amount_paid`
 *     (eenmalig gezet zodra de eerste child binnenkomt) zodat we de bron
 *     niet kwijtraken.
 *   - Zet parent.amount_paid = original + sum(children.amount_paid) zodat
 *     het restant op de parent-rij correct naar 0 zakt en zowel UI-tabel
 *     als computeUpcomingPayment de juiste status tonen.
 */
async function recalculateParentPayment(parentId: string): Promise<void> {
  const supabase = await createClient();
  const { data: parent } = await supabase
    .from("membership_payment_logs")
    .select("id, amount_expected, amount_paid, original_amount_paid")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) return;
  const parentRow = parent as {
    id: string;
    amount_expected: number | null;
    amount_paid: number | null;
    original_amount_paid: number | null;
  };

  const { data: kids } = await supabase
    .from("membership_payment_logs")
    .select("amount_paid")
    .eq("parent_payment_id", parentId);
  const childTotal = ((kids ?? []) as Array<{ amount_paid: number | null }>)
    .reduce((acc, k) => acc + (k.amount_paid ?? 0), 0);

  const original =
    parentRow.original_amount_paid ?? parentRow.amount_paid ?? 0;
  const totalPaid = original + childTotal;
  const status = deriveStatus({
    amount_paid: totalPaid,
    amount_expected: parentRow.amount_expected,
  });

  await supabase
    .from("membership_payment_logs")
    .update({
      original_amount_paid: original,
      amount_paid: totalPaid,
      amount: totalPaid,
      status,
    })
    .eq("id", parentId);
}

export async function updateMembershipPayment(
  input: UpdatePaymentInput,
): Promise<ActionResult<MembershipPaymentLog>> {
  const parsed = updatePaymentSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const mm = await loadMembershipForTenant(
    parsed.data.tenant_id,
    parsed.data.member_membership_id,
  );
  if (!mm) return fail("Abonnement niet gevonden.");

  const refErr = await validatePaymentRefsForTenant(parsed.data.tenant_id, {
    membership_plan_id: parsed.data.membership_plan_id,
    paid_via_payment_method_id: parsed.data.paid_via_payment_method_id,
    parent_payment_id: parsed.data.parent_payment_id,
  });
  if (refErr) return fail(refErr);

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("membership_payment_logs")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!before) return fail("Betaling niet gevonden.");

  const row = paymentRowFromInput(parsed.data);
  const { data, error } = await supabase
    .from("membership_payment_logs")
    .update(row)
    .eq("id", parsed.data.id)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon betaling niet bijwerken.");

  await recordPaymentAudit({
    payment_id: parsed.data.id,
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "updated",
    note: parsed.data.audit_note,
    before: before as Record<string, unknown>,
    after: data as Record<string, unknown>,
  });

  if ((before as MembershipPaymentLog).parent_payment_id) {
    await recalculateParentPayment(
      (before as MembershipPaymentLog).parent_payment_id!,
    );
  }

  revalidatePath(`/tenant/members/${mm.member_id}`);
  return { ok: true, data: data as MembershipPaymentLog };
}

export async function deleteMembershipPayment(
  input: DeletePaymentInput,
): Promise<ActionResult<void>> {
  const parsed = deletePaymentSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("membership_payment_logs")
    .select("*, member_memberships!inner(member_id, members!inner(tenant_id))")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!before) return fail("Betaling niet gevonden.");
  const beforeRow = before as MembershipPaymentLog & {
    member_memberships: { member_id: string; members: { tenant_id: string } };
  };
  if (beforeRow.member_memberships.members.tenant_id !== parsed.data.tenant_id) {
    return fail("Geen toegang.");
  }

  // Audit-rij eerst noteren — daarna verwijderen we de bron-rij. We kopiëren
  // de relevante kolommen naar `before`-jsonb zodat het audit-record blijft
  // staan ook al wordt de bron-rij weggevaagd door de cascade.
  await recordPaymentAudit({
    payment_id: parsed.data.id,
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "deleted",
    note: parsed.data.audit_note,
    before: beforeRow as unknown as Record<string, unknown>,
    after: null,
  });

  const { error } = await supabase
    .from("membership_payment_logs")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  if (beforeRow.parent_payment_id) {
    await recalculateParentPayment(beforeRow.parent_payment_id);
  }

  revalidatePath(`/tenant/members/${beforeRow.member_memberships.member_id}`);
  return { ok: true, data: undefined };
}

// ── 3. Membership beëindigen ──────────────────────────────

export async function endMemberMembership(
  input: EndMembershipInput,
): Promise<ActionResult<MemberMembership>> {
  const parsed = endMembershipSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const mm = await loadMembershipForTenant(
    parsed.data.tenant_id,
    parsed.data.member_membership_id,
  );
  if (!mm) return fail("Abonnement niet gevonden.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_memberships")
    .update({
      status: "ended",
      end_date: parsed.data.end_date,
      ended_at: new Date().toISOString(),
      end_reason: parsed.data.end_reason,
    })
    .eq("id", parsed.data.member_membership_id)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon abonnement niet beëindigen.");

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: mm.member_id,
    action: "membership.end",
    meta: {
      member_membership_id: parsed.data.member_membership_id,
      end_date: parsed.data.end_date,
      end_reason: parsed.data.end_reason ?? null,
    },
  });

  revalidatePath(`/tenant/members/${mm.member_id}`);
  return { ok: true, data: data as MemberMembership };
}

// ── 4. Helpers (used at action-call sites) ────────────────

export async function getTenantDefaults(tenantId: string): Promise<{
  plan: MembershipPlan | null;
  payment_method: PaymentMethod | null;
}> {
  const supabase = await createClient();
  const [{ data: plan }, { data: pm }] = await Promise.all([
    supabase
      .from("membership_plans")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("payment_methods")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .is("archived_at", null)
      .maybeSingle(),
  ]);
  return {
    plan: (plan as MembershipPlan | null) ?? null,
    payment_method: (pm as PaymentMethod | null) ?? null,
  };
}
