"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import {
  createMemberSchema,
  updateMemberSchema,
  MEMBER_ROLES,
  type CreateMemberInput,
  type UpdateMemberInput,
} from "@/lib/validation/members";
import {
  createGroupSchema,
  updateGroupSchema,
  type CreateGroupInput,
  type UpdateGroupInput,
} from "@/lib/validation/groups";
import {
  createMembershipPlanSchema,
  type CreateMembershipPlanInput,
} from "@/lib/validation/membership-plans";
import { sendNotification } from "@/lib/notifications/send-notification";
import { getNotificationEvent } from "@/lib/db/notifications";
import { recordAudit } from "@/lib/audit/log";
import type {
  Member,
  Group,
  MembershipPlan,
  MemberMembership,
  MembershipPaymentLog,
} from "@/types/database";

function logTriggerErr(tag: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[members:${tag}] notification failed:`, err instanceof Error ? err.message : err);
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

// ── members ─────────────────────────────────────────────────

export async function createMember(
  input: CreateMemberInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createMemberSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  const { roles, ...memberInsert } = parsed.data;

  const { data: created, error } = await supabase
    .from("members")
    .insert(memberInsert)
    .select("id")
    .single();
  if (error || !created) return fail(error?.message ?? "Failed to create member.");

  if (roles.length > 0) {
    const rows = roles.map((r) => ({ member_id: created.id, role: r }));
    const { error: roleErr } = await supabase.from("member_roles").insert(rows);
    if (roleErr) return fail(roleErr.message);
  }

  // Sprint 30 — auto-assign tenant-default plan + payment-method.
  // Errors worden niet meer stil geslikt: ze komen als actionable fail()
  // terug zodat de UI de tenant-admin kan informeren en handmatig kan
  // bijsturen (lid is dan al aangemaakt; defaults kunnen via de
  // ledendetail later toegevoegd worden — idempotent retrybaar).
  const { data: defPlan, error: defPlanErr } = await supabase
    .from("membership_plans")
    .select("id")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (defPlanErr) return fail(`Standaard abonnement ophalen mislukt: ${defPlanErr.message}`);
  if (defPlan) {
    const { error: planInsErr } = await supabase
      .from("member_memberships")
      .insert({
        member_id: created.id,
        membership_plan_id: (defPlan as { id: string }).id,
        status: "active",
        start_date: new Date().toISOString().slice(0, 10),
      });
    if (planInsErr) {
      return fail(`Standaard abonnement koppelen mislukt: ${planInsErr.message}`);
    }
  }

  const isStaffOrTrainer =
    roles.includes("trainer") || roles.includes("staff");
  if (!isStaffOrTrainer) {
    const { data: defPm, error: defPmErr } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("tenant_id", parsed.data.tenant_id)
      .eq("is_default", true)
      .is("archived_at", null)
      .maybeSingle();
    if (defPmErr) return fail(`Standaard methode ophalen mislukt: ${defPmErr.message}`);
    if (defPm) {
      const { error: pmInsErr } = await supabase
        .from("member_financial_details")
        .upsert(
          {
            member_id: created.id,
            tenant_id: parsed.data.tenant_id,
            payment_method_id: (defPm as { id: string }).id,
          },
          { onConflict: "member_id" },
        );
      if (pmInsErr) {
        return fail(`Standaard methode koppelen mislukt: ${pmInsErr.message}`);
      }
    }
  }

  revalidatePath("/tenant/members");
  return { ok: true, data: { id: created.id } };
}

export async function updateMember(
  input: UpdateMemberInput,
): Promise<ActionResult<Member>> {
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("members")
    .select("id, tenant_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (fetchErr) return fail(fetchErr.message);
  if (!existing) return fail("Member not found.");
  if (existing.tenant_id !== parsed.data.tenant_id) return fail("Tenant mismatch.");

  const { id, tenant_id, roles, ...patch } = parsed.data;
  const cleanPatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) cleanPatch[k] = v;
  }
  // Sprint F — keep archived_at consistent with member_status. If the admin
  // flips the status back to anything non-"archived" via this form we must
  // also clear archived_at/archived_by, otherwise the row stays hidden from
  // the default members list (which filters on archived_at IS NULL).
  if (
    typeof cleanPatch.member_status === "string" &&
    cleanPatch.member_status !== "archived"
  ) {
    cleanPatch.archived_at = null;
    cleanPatch.archived_by = null;
  }

  const { data, error } = await supabase
    .from("members")
    .update(cleanPatch)
    .eq("id", id)
    .eq("tenant_id", tenant_id)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Failed to update member.");

  if (roles) {
    // Replace the role set.
    await supabase.from("member_roles").delete().eq("member_id", id);
    if (roles.length > 0) {
      const rows = roles.map((r) => ({ member_id: id, role: r }));
      const { error: roleErr } = await supabase.from("member_roles").insert(rows);
      if (roleErr) return fail(roleErr.message);
    }
  }

  revalidatePath("/tenant/members");
  revalidatePath(`/tenant/members/${id}`);
  return { ok: true, data: data as Member };
}

// ── individual member roles (Sprint 39) ────────────────────
//
// `member_roles` is een multi-row tabel (sprint8) zodat een lid meerdere
// rollen tegelijk kan hebben. De bestaande `updateMember` action vervangt
// de hele set in één keer; voor de chip-UI op de admin-detail pagina
// hebben we expliciete add/remove acties die idempotent zijn en duidelijke
// foutmeldingen teruggeven.

const memberRoleMutationSchema = z.object({
  tenant_id: z.string().uuid(),
  member_id: z.string().uuid(),
  role: z.enum(MEMBER_ROLES),
});

async function ensureMemberInTenant(
  tenantId: string,
  memberId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return !!data;
}

export async function addMemberRole(
  input: z.infer<typeof memberRoleMutationSchema>,
): Promise<ActionResult<{ role: string }>> {
  const parsed = memberRoleMutationSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer");

  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await ensureMemberInTenant(parsed.data.tenant_id, parsed.data.member_id))) {
    return fail("Lid niet gevonden in deze vereniging.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("member_roles")
    .insert({ member_id: parsed.data.member_id, role: parsed.data.role });
  if (error) {
    if (error.code === "23505") {
      return fail("Dit lid heeft deze rol al.");
    }
    return fail(error.message);
  }

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: parsed.data.member_id,
    action: "member.role.add",
    meta: { role: parsed.data.role },
  });

  revalidatePath("/tenant/members");
  revalidatePath(`/tenant/members/${parsed.data.member_id}`);
  return { ok: true, data: { role: parsed.data.role } };
}

export async function removeMemberRole(
  input: z.infer<typeof memberRoleMutationSchema>,
): Promise<ActionResult<{ remaining: number }>> {
  const parsed = memberRoleMutationSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer");

  const user = await assertTenantAccess(parsed.data.tenant_id);
  if (!(await ensureMemberInTenant(parsed.data.tenant_id, parsed.data.member_id))) {
    return fail("Lid niet gevonden in deze vereniging.");
  }

  const supabase = await createClient();

  // Tel huidige rollen om te kunnen waarschuwen voor "laatste rol".
  const { data: currentRows, error: countErr } = await supabase
    .from("member_roles")
    .select("role")
    .eq("member_id", parsed.data.member_id);
  if (countErr) return fail(countErr.message);

  const current = ((currentRows ?? []) as Array<{ role: string }>).map((r) => r.role);
  if (!current.includes(parsed.data.role)) {
    return fail("Dit lid heeft deze rol niet.");
  }
  if (current.length <= 1) {
    return fail(
      "Een lid moet minstens één rol behouden. Voeg eerst een andere rol toe.",
    );
  }

  const { error: delErr } = await supabase
    .from("member_roles")
    .delete()
    .eq("member_id", parsed.data.member_id)
    .eq("role", parsed.data.role);
  if (delErr) return fail(delErr.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: parsed.data.member_id,
    action: "member.role.remove",
    meta: { role: parsed.data.role },
  });

  revalidatePath("/tenant/members");
  revalidatePath(`/tenant/members/${parsed.data.member_id}`);
  return { ok: true, data: { remaining: current.length - 1 } };
}

// ── parent ↔ child links ───────────────────────────────────

const linkParentChildSchema = z
  .object({
    tenant_id: z.string().uuid(),
    parent_member_id: z.string().uuid(),
    child_member_id: z.string().uuid(),
  })
  .refine((v) => v.parent_member_id !== v.child_member_id, {
    message: "A member cannot be linked to themselves.",
    path: ["child_member_id"],
  });

export async function linkParentChild(
  input: z.infer<typeof linkParentChildSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = linkParentChildSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();

  // Verify both members belong to this tenant.
  const { data: members, error: mErr } = await supabase
    .from("members")
    .select("id, tenant_id")
    .in("id", [parsed.data.parent_member_id, parsed.data.child_member_id])
    .eq("tenant_id", parsed.data.tenant_id);
  if (mErr) return fail(mErr.message);
  if (!members || members.length !== 2) return fail("Beide leden moeten bij deze tenant horen.");

  const { data, error } = await supabase
    .from("member_links")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return fail("Deze koppeling bestaat al.");
    return fail(error?.message ?? "Kon koppeling niet maken.");
  }

  revalidatePath(`/tenant/members/${parsed.data.parent_member_id}`);
  revalidatePath(`/tenant/members/${parsed.data.child_member_id}`);
  return { ok: true, data };
}

// Sprint F — verwijder een ouder ↔ kind koppeling.
export async function unlinkParentChild(
  input: z.infer<typeof linkParentChildSchema>,
): Promise<ActionResult<{ removed: number }>> {
  const parsed = linkParentChildSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("member_links")
    .delete({ count: "exact" })
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("parent_member_id", parsed.data.parent_member_id)
    .eq("child_member_id", parsed.data.child_member_id);
  if (error) return fail(error.message);

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "member.unlink_parent_child",
    meta: {
      parent: parsed.data.parent_member_id,
      child: parsed.data.child_member_id,
    },
  });

  revalidatePath(`/tenant/members/${parsed.data.parent_member_id}`);
  revalidatePath(`/tenant/members/${parsed.data.child_member_id}`);
  return { ok: true, data: { removed: count ?? 0 } };
}

// ── archive / unarchive (soft-delete) ─────────────────────

const archiveMemberSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
});

export async function archiveMember(
  input: z.infer<typeof archiveMemberSchema>,
): Promise<ActionResult<Member>> {
  const parsed = archiveMemberSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: user.id,
      member_status: "archived",
    })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon lid niet archiveren.");

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: parsed.data.id,
    action: "member.archive",
  });
  revalidatePath("/tenant/members");
  revalidatePath(`/tenant/members/${parsed.data.id}`);
  return { ok: true, data: data as Member };
}

export async function unarchiveMember(
  input: z.infer<typeof archiveMemberSchema>,
): Promise<ActionResult<Member>> {
  const parsed = archiveMemberSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input");
  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .update({
      archived_at: null,
      archived_by: null,
      member_status: "active",
    })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon lid niet dearchiveren.");

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: parsed.data.id,
    action: "member.unarchive",
  });
  revalidatePath("/tenant/members");
  revalidatePath(`/tenant/members/${parsed.data.id}`);
  return { ok: true, data: data as Member };
}

// ── groups ─────────────────────────────────────────────────

export async function createGroup(
  input: CreateGroupInput,
): Promise<ActionResult<Group>> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .insert({
      tenant_id: parsed.data.tenant_id,
      name: parsed.data.name,
      description: parsed.data.description,
      max_members: parsed.data.max_members,
      max_athletes: parsed.data.max_athletes,
    })
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon groep niet aanmaken.");

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "group.created",
    meta: {
      group_id: (data as Group).id,
      name: parsed.data.name,
      max_members: parsed.data.max_members ?? null,
      max_athletes: parsed.data.max_athletes ?? null,
    },
  });

  revalidatePath("/tenant/groups");
  return { ok: true, data: data as Group };
}

// Sprint 42 — separate update action so the inline edit form on the
// detail page can change name / description / max_members without
// touching the create flow.
export async function updateGroup(
  input: UpdateGroupInput,
): Promise<ActionResult<Group>> {
  const parsed = updateGroupSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  // Existing member-count check: weiger lager te zetten dan huidig aantal.
  if (parsed.data.max_members != null) {
    const { count } = await supabase
      .from("group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", parsed.data.id);
    if ((count ?? 0) > parsed.data.max_members) {
      return fail(
        `Maximum (${parsed.data.max_members}) is lager dan huidige bezetting (${count}).`,
      );
    }
  }

  // Sprint 45 — zelfde guard voor max_athletes (alleen athlete-rol meetellen).
  if (parsed.data.max_athletes != null) {
    const { data: gmRows } = await supabase
      .from("group_members")
      .select("member_id, member_roles!inner(role)")
      .eq("group_id", parsed.data.id)
      .eq("member_roles.role", "athlete");
    const athleteCount = (gmRows ?? []).length;
    if (athleteCount > parsed.data.max_athletes) {
      return fail(
        `Maximum atleten (${parsed.data.max_athletes}) is lager dan huidige aantal (${athleteCount}).`,
      );
    }
  }

  const { data, error } = await supabase
    .from("groups")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      max_members: parsed.data.max_members,
      max_athletes: parsed.data.max_athletes,
    })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon groep niet bijwerken.");

  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    action: "group.updated",
    meta: {
      group_id: parsed.data.id,
      max_members: parsed.data.max_members ?? null,
      max_athletes: parsed.data.max_athletes ?? null,
    },
  });

  revalidatePath("/tenant/groups");
  revalidatePath(`/tenant/groups/${parsed.data.id}`);
  return { ok: true, data: data as Group };
}

const groupMemberSchema = z.object({
  tenant_id: z.string().uuid(),
  group_id: z.string().uuid(),
  member_id: z.string().uuid(),
});

export async function addMemberToGroup(
  input: z.infer<typeof groupMemberSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = groupMemberSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  // Verify both group + member belong to the tenant.
  const [{ data: g }, { data: m }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, tenant_id, max_members, max_athletes")
      .eq("id", parsed.data.group_id)
      .eq("tenant_id", parsed.data.tenant_id)
      .maybeSingle(),
    supabase
      .from("members")
      .select("id, tenant_id")
      .eq("id", parsed.data.member_id)
      .eq("tenant_id", parsed.data.tenant_id)
      .maybeSingle(),
  ]);
  if (!g) return fail("Groep niet gevonden.");
  if (!m) return fail("Lid niet gevonden.");

  // Sprint 42 — handhaaf max_members vóór insert. Race-conditie kan
  // theoretisch nog 1 lid extra binnenlaten als twee admins gelijktijdig
  // toevoegen; voor onze schaal acceptabel — hard guard zit in de UI én
  // hier in de pre-check. DB-trigger heeft het laatste woord.
  const groupRow = g as {
    id: string;
    max_members: number | null;
    max_athletes: number | null;
  };
  if (groupRow.max_members != null) {
    const { count } = await supabase
      .from("group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", parsed.data.group_id);
    if ((count ?? 0) >= groupRow.max_members) {
      return fail(
        `Groep is vol (${groupRow.max_members} ${
          groupRow.max_members === 1 ? "plek" : "plekken"
        }).`,
      );
    }
  }

  // Sprint 45 — als toe te voegen lid de rol 'athlete' heeft, ook
  // max_athletes checken.
  if (groupRow.max_athletes != null) {
    const { data: roleRows } = await supabase
      .from("member_roles")
      .select("role")
      .eq("member_id", parsed.data.member_id);
    const isAthlete = ((roleRows ?? []) as Array<{ role: string }>).some(
      (r) => r.role === "athlete",
    );
    if (isAthlete) {
      const { data: athleteRows } = await supabase
        .from("group_members")
        .select("member_id, member_roles!inner(role)")
        .eq("group_id", parsed.data.group_id)
        .eq("member_roles.role", "athlete");
      if ((athleteRows ?? []).length >= groupRow.max_athletes) {
        return fail(
          `Maximum atleten bereikt (${groupRow.max_athletes}).`,
        );
      }
    }
  }

  const { data, error } = await supabase
    .from("group_members")
    .insert({ group_id: parsed.data.group_id, member_id: parsed.data.member_id })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return fail("Lid zit al in deze groep.");
    if (
      error?.code === "23514" ||
      error?.message?.includes("group_members_max_exceeded")
    ) {
      return fail(
        groupRow.max_members != null
          ? `Groep is vol (${groupRow.max_members} ${
              groupRow.max_members === 1 ? "plek" : "plekken"
            }).`
          : "Groep is vol.",
      );
    }
    if (error?.message?.includes("group_athletes_max_exceeded")) {
      return fail(
        groupRow.max_athletes != null
          ? `Maximum atleten bereikt (${groupRow.max_athletes}).`
          : "Maximum atleten bereikt.",
      );
    }
    return fail(error?.message ?? "Kon lid niet toevoegen.");
  }

  // Sprint 42 — audit trail voor groepswijzigingen.
  await recordAudit({
    tenant_id: parsed.data.tenant_id,
    actor_user_id: user.id,
    member_id: parsed.data.member_id,
    action: "group.member_added",
    meta: { group_id: parsed.data.group_id },
  });

  // Sprint 35 — backfill attendance rows for already-scheduled future
  // sessions of this group so the new member shows up on the trainer's
  // manage screen and in their own agenda.
  try {
    const admin = createAdminClient();
    const { data: futureSessions } = await admin
      .from("training_sessions")
      .select("id")
      .eq("tenant_id", parsed.data.tenant_id)
      .eq("group_id", parsed.data.group_id)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString());
    const sessionIds = ((futureSessions ?? []) as Array<{ id: string }>).map(
      (s) => s.id,
    );
    if (sessionIds.length > 0) {
      const rows = sessionIds.map((sid) => ({
        tenant_id: parsed.data.tenant_id,
        session_id: sid,
        member_id: parsed.data.member_id,
      }));
      await admin
        .from("training_attendance")
        .upsert(rows, { onConflict: "session_id,member_id" });
    }
  } catch (err) {
    logTriggerErr("attendance_backfill", err);
  }

  // Sprint 12 — group_assigned trigger.
  try {
    const evt = await getNotificationEvent(parsed.data.tenant_id, "group_assigned");
    if (!evt || evt.template_enabled) {
      const { data: gn } = await supabase
        .from("groups")
        .select("name")
        .eq("id", parsed.data.group_id)
        .maybeSingle();
      const groupName = (gn?.name as string | undefined) ?? "een groep";
      await sendNotification({
        tenantId: parsed.data.tenant_id,
        title: `Toegevoegd aan groep: ${groupName}`,
        contentText: `Je bent toegevoegd aan de groep ${groupName}.`,
        targets: [{ target_type: "member", target_id: parsed.data.member_id }],
        sendEmail: evt?.email_enabled ?? false,
        source: "group_assigned",
        // Sprint 41 — use the group_members row id so the idempotency key
        // is unique per (member, group) pair. Using group_id alone would
        // make the partial unique index dedupe legitimate notifications
        // for *other* members added to the same group.
        sourceRef: data.id,
      });
    }
  } catch (err) {
    logTriggerErr("group_assigned", err);
  }

  revalidatePath("/tenant/groups");
  revalidatePath(`/tenant/members/${parsed.data.member_id}`);
  return { ok: true, data };
}

export async function removeMemberFromGroup(
  input: z.infer<typeof groupMemberSchema>,
): Promise<ActionResult<{ removed: number }>> {
  const parsed = groupMemberSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  // Verify both the group AND the member belong to this tenant before
  // deleting. Without the member-tenant check, a user holding access to
  // tenant A could pass a group_id from tenant A together with a member_id
  // from tenant B and the join-table RLS policy would still allow it
  // (it only checks that the group's tenant matches).
  const [{ data: g }, { data: m }] = await Promise.all([
    supabase
      .from("groups")
      .select("id")
      .eq("id", parsed.data.group_id)
      .eq("tenant_id", parsed.data.tenant_id)
      .maybeSingle(),
    supabase
      .from("members")
      .select("id")
      .eq("id", parsed.data.member_id)
      .eq("tenant_id", parsed.data.tenant_id)
      .maybeSingle(),
  ]);
  if (!g) return fail("Groep niet gevonden.");
  if (!m) return fail("Lid niet gevonden.");

  const { error, count } = await supabase
    .from("group_members")
    .delete({ count: "exact" })
    .eq("group_id", parsed.data.group_id)
    .eq("member_id", parsed.data.member_id);
  if (error) return fail(error.message);

  if ((count ?? 0) > 0) {
    await recordAudit({
      tenant_id: parsed.data.tenant_id,
      actor_user_id: user.id,
      member_id: parsed.data.member_id,
      action: "group.member_removed",
      meta: { group_id: parsed.data.group_id },
    });
  }

  revalidatePath("/tenant/groups");
  revalidatePath(`/tenant/groups/${parsed.data.group_id}`);
  revalidatePath(`/tenant/members/${parsed.data.member_id}`);
  return { ok: true, data: { removed: count ?? 0 } };
}

// Sprint 42 — bulk add gebruikt door de CSV-import flow op de detail-pagina.
// Wordt vóór insert gevalideerd (max_members + dubbele rijen) zodat een
// foute import in zijn geheel niets toevoegt en de admin een duidelijk
// rapport krijgt.
export interface BulkAddResultRow {
  member_id: string;
  ok: boolean;
  reason?: string;
}

export async function bulkAddMembersToGroup(input: {
  tenant_id: string;
  group_id: string;
  member_ids: string[];
}): Promise<
  ActionResult<{ added: number; skipped: BulkAddResultRow[] }>
> {
  if (
    !input ||
    typeof input.tenant_id !== "string" ||
    typeof input.group_id !== "string" ||
    !Array.isArray(input.member_ids)
  ) {
    return fail("Ongeldige invoer");
  }

  const tenantId = input.tenant_id;
  const groupId = input.group_id;
  // Sprint 42 — bewaar de volgorde én rapporteer duplicate-rijen expliciet
  // i.p.v. ze stilzwijgend te dedupliceren via Set. Eerste hit wint, latere
  // hits krijgen `reason: 'Dubbele rij in CSV'` zodat de admin weet wat er
  // gebeurd is.
  const rawIds = (input.member_ids ?? []).filter(
    (s) => typeof s === "string" && s.length > 0,
  );
  const seen = new Set<string>();
  const memberIds: string[] = [];
  const dupSkipped: BulkAddResultRow[] = [];
  for (const id of rawIds) {
    if (seen.has(id)) {
      dupSkipped.push({ member_id: id, ok: false, reason: "Dubbele rij in CSV" });
      continue;
    }
    seen.add(id);
    memberIds.push(id);
  }
  if (memberIds.length === 0) {
    return { ok: true, data: { added: 0, skipped: dupSkipped } };
  }

  const user = await assertTenantAccess(tenantId);
  const supabase = await createClient();

  const { data: g } = await supabase
    .from("groups")
    .select("id, max_members, max_athletes")
    .eq("id", groupId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!g) return fail("Groep niet gevonden.");
  const groupRow = g as {
    id: string;
    max_members: number | null;
    max_athletes: number | null;
  };

  // Filter member-ids tegen tenant + bestaande lidmaatschappen.
  const [{ data: existingMembers }, { data: existingLinks }] = await Promise.all([
    supabase
      .from("members")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("id", memberIds),
    supabase
      .from("group_members")
      .select("member_id")
      .eq("group_id", groupId)
      .in("member_id", memberIds),
  ]);
  const validIds = new Set(
    ((existingMembers ?? []) as Array<{ id: string }>).map((r) => r.id),
  );
  const alreadyIn = new Set(
    ((existingLinks ?? []) as Array<{ member_id: string }>).map((r) => r.member_id),
  );

  const skipped: BulkAddResultRow[] = [...dupSkipped];
  const toInsert: string[] = [];
  for (const id of memberIds) {
    if (!validIds.has(id)) {
      skipped.push({ member_id: id, ok: false, reason: "Lid niet gevonden in deze tenant." });
      continue;
    }
    if (alreadyIn.has(id)) {
      skipped.push({ member_id: id, ok: false, reason: "Zit al in de groep." });
      continue;
    }
    toInsert.push(id);
  }

  if (toInsert.length === 0) {
    return { ok: true, data: { added: 0, skipped } };
  }

  if (groupRow.max_members != null) {
    const currentCount =
      ((existingMembers ?? []) as Array<{ id: string }>).length === 0
        ? 0
        : alreadyIn.size;
    // We hebben de huidige bezetting niet exact (alleen het deel binnen onze
    // input set). Doe dus een echte head-count.
    const { count } = await supabase
      .from("group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId);
    const remaining = groupRow.max_members - (count ?? currentCount);
    if (toInsert.length > remaining) {
      return fail(
        `Import overschrijdt maximum: ${count ?? 0} + ${toInsert.length} > ${groupRow.max_members}.`,
      );
    }
  }

  // Sprint 45 — guard op max_athletes voor de import-set.
  if (groupRow.max_athletes != null && toInsert.length > 0) {
    const { data: athleteRoleRows } = await supabase
      .from("member_roles")
      .select("member_id")
      .in("member_id", toInsert)
      .eq("role", "athlete");
    const incomingAthletes = new Set(
      ((athleteRoleRows ?? []) as Array<{ member_id: string }>).map(
        (r) => r.member_id,
      ),
    );
    const incomingAthleteCount = toInsert.filter((id) =>
      incomingAthletes.has(id),
    ).length;
    if (incomingAthleteCount > 0) {
      const { data: currentAthleteRows } = await supabase
        .from("group_members")
        .select("member_id, member_roles!inner(role)")
        .eq("group_id", groupId)
        .eq("member_roles.role", "athlete");
      const currentAthletes = (currentAthleteRows ?? []).length;
      if (currentAthletes + incomingAthleteCount > groupRow.max_athletes) {
        return fail(
          `Import overschrijdt maximum atleten: ${currentAthletes} + ${incomingAthleteCount} > ${groupRow.max_athletes}.`,
        );
      }
    }
  }

  const rows = toInsert.map((mid) => ({ group_id: groupId, member_id: mid }));
  const { error } = await supabase.from("group_members").insert(rows);
  if (error) return fail(error.message);

  // Audit per inserted row (best-effort, parallel).
  await Promise.all(
    toInsert.map((mid) =>
      recordAudit({
        tenant_id: tenantId,
        actor_user_id: user.id,
        member_id: mid,
        action: "group.member_added",
        meta: { group_id: groupId, source: "csv_import" },
      }),
    ),
  );

  revalidatePath("/tenant/groups");
  revalidatePath(`/tenant/groups/${groupId}`);
  return { ok: true, data: { added: toInsert.length, skipped } };
}

// ── membership plans ───────────────────────────────────────

export async function createMembershipPlan(
  input: CreateMembershipPlanInput,
): Promise<ActionResult<MembershipPlan>> {
  const parsed = createMembershipPlanSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("membership_plans")
    .insert(parsed.data)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon abonnement niet aanmaken.");

  revalidatePath("/tenant/memberships");
  return { ok: true, data: data as MembershipPlan };
}

const togglePlanSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
  is_active: z.boolean(),
});

export async function setMembershipPlanActive(
  input: z.infer<typeof togglePlanSchema>,
): Promise<ActionResult<MembershipPlan>> {
  const parsed = togglePlanSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("membership_plans")
    .update({ is_active: parsed.data.is_active })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon abonnement niet bijwerken.");

  revalidatePath("/tenant/memberships");
  return { ok: true, data: data as MembershipPlan };
}

// ── member memberships ────────────────────────────────────

const assignSchema = z.object({
  tenant_id: z.string().uuid(),
  member_id: z.string().uuid(),
  membership_plan_id: z.string().uuid(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige startdatum")
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige einddatum")
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  status: z.enum(["active", "paused", "cancelled"]).default("active"),
});

export async function assignMembershipPlan(
  input: z.infer<typeof assignSchema>,
): Promise<ActionResult<MemberMembership>> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  // Verify both member + plan belong to this tenant.
  const [{ data: m }, { data: p }] = await Promise.all([
    supabase
      .from("members")
      .select("id, tenant_id")
      .eq("id", parsed.data.member_id)
      .eq("tenant_id", parsed.data.tenant_id)
      .maybeSingle(),
    supabase
      .from("membership_plans")
      .select("id, tenant_id")
      .eq("id", parsed.data.membership_plan_id)
      .eq("tenant_id", parsed.data.tenant_id)
      .maybeSingle(),
  ]);
  if (!m) return fail("Lid niet gevonden.");
  if (!p) return fail("Abonnement niet gevonden.");

  const { tenant_id: _t, ...row } = parsed.data;
  const { data, error } = await supabase
    .from("member_memberships")
    .insert(row)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon abonnement niet toewijzen.");

  // Sprint 12 — membership_assigned trigger.
  try {
    const evt = await getNotificationEvent(parsed.data.tenant_id, "membership_assigned");
    if (!evt || evt.template_enabled) {
      const { data: plan } = await supabase
        .from("membership_plans")
        .select("name")
        .eq("id", parsed.data.membership_plan_id)
        .maybeSingle();
      const planName = (plan?.name as string | undefined) ?? "een abonnement";
      await sendNotification({
        tenantId: parsed.data.tenant_id,
        title: `Abonnement toegewezen: ${planName}`,
        contentText: `Het abonnement ${planName} is aan je toegewezen.`,
        targets: [{ target_type: "member", target_id: parsed.data.member_id }],
        sendEmail: evt?.email_enabled ?? false,
        source: "membership_assigned",
        sourceRef: (data as MemberMembership).id,
      });
    }
  } catch (err) {
    logTriggerErr("membership_assigned", err);
  }

  revalidatePath(`/tenant/members/${parsed.data.member_id}`);
  return { ok: true, data: data as MemberMembership };
}

// ── payment log ───────────────────────────────────────────

const paymentSchema = z.object({
  tenant_id: z.string().uuid(),
  member_membership_id: z.string().uuid(),
  amount: z
    .union([z.number(), z.string()])
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (!Number.isNaN(v) && v >= 0), "Ongeldig bedrag")
    .nullable()
    .default(null),
  status: z.enum(["paid", "due", "overdue", "waived"]).default("due"),
  paid_at: z
    .string()
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  note: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export async function logMembershipPayment(
  input: z.infer<typeof paymentSchema>,
): Promise<ActionResult<MembershipPaymentLog>> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  // Verify the membership belongs to a member in this tenant.
  const { data: mm } = await supabase
    .from("member_memberships")
    .select("id, member_id, members!inner(tenant_id)")
    .eq("id", parsed.data.member_membership_id)
    .eq("members.tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!mm) return fail("Abonnement niet gevonden.");

  const memberId = (mm as { member_id: string }).member_id;

  const { tenant_id: _t, ...row } = parsed.data;
  const { data, error } = await supabase
    .from("membership_payment_logs")
    .insert(row)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon betaling niet loggen.");

  revalidatePath(`/tenant/members/${memberId}`);
  return { ok: true, data: data as MembershipPaymentLog };
}

