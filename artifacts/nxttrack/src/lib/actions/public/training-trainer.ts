"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { trainerInSessionGroup } from "@/lib/auth/trainer-rules";
import { sendNotification } from "@/lib/notifications/send-notification";
import { getNotificationEvent } from "@/lib/db/notifications";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import {
  setAttendanceSchema,
  createObservationSchema,
  type SetAttendanceInput,
  type CreateObservationInput,
} from "@/lib/validation/trainings";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}
function logErr(tag: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[trainer] ${tag}:`, err instanceof Error ? err.message : err);
}

/**
 * Sprint 35 — trainer marks attendance from the user-shell "Manage" screen.
 * Authorization: user must be a trainer of the session's group
 * (member_roles.role='trainer' OR a tenant_role with is_trainer_role).
 */
export async function setAttendanceAsTrainer(
  input: SetAttendanceInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = setAttendanceSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await requireAuth();
  const auth = await trainerInSessionGroup(
    parsed.data.tenant_id,
    user.id,
    parsed.data.session_id,
  );
  if (!auth) return fail("Geen toegang.");

  const admin = createAdminClient();

  // Ensure target member is actually in the same group.
  const { data: gm } = await admin
    .from("group_members")
    .select("member_id")
    .eq("group_id", auth.groupId)
    .eq("member_id", parsed.data.member_id)
    .maybeSingle();
  if (!gm) return fail("Lid hoort niet bij deze training.");

  const { data, error } = await admin
    .from("training_attendance")
    .upsert(
      {
        tenant_id: parsed.data.tenant_id,
        session_id: parsed.data.session_id,
        member_id: parsed.data.member_id,
        attendance: parsed.data.attendance,
        attendance_at: new Date().toISOString(),
        attendance_by_user_id: user.id,
        note: parsed.data.note,
        note_visibility: parsed.data.note_visibility,
        notes: parsed.data.note_visibility === "member" ? parsed.data.note : null,
        trainer_note:
          parsed.data.note_visibility === "private" ? parsed.data.note : null,
        absence_reason: parsed.data.absence_reason ?? null,
      },
      { onConflict: "session_id,member_id" },
    )
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Kon aanwezigheid niet opslaan.");

  // Notify the lid/ouder when a member-visible note OR mark changed.
  try {
    const evt = await getNotificationEvent(
      parsed.data.tenant_id,
      "trainer_attendance_updated",
    );
    if (evt && evt.template_enabled) {
      const labels: Record<string, string> = {
        present: "Aanwezig",
        absent: "Afwezig",
        late: "Te laat",
        injured: "Geblesseerd",
      };
      const memberVisibleNote =
        parsed.data.note_visibility === "member" ? parsed.data.note : null;
      const t = await getTenantTerminology(parsed.data.tenant_id);
      await sendNotification({
        tenantId: parsed.data.tenant_id,
        title: `${t.attendance_label} bijgewerkt: ${labels[parsed.data.attendance] ?? parsed.data.attendance}`,
        contentText: memberVisibleNote ?? "",
        targets: [{ target_type: "member", target_id: parsed.data.member_id }],
        sendEmail: evt.email_enabled,
        source: "trainer_attendance_updated",
        // Sprint 43 — training_attendance row id is unique per
        // (member, session); session_id alone would dedupe legitimate
        // notifications for other members in the same session.
        sourceRef: data.id,
        createdBy: user.id,
      });
    }
  } catch (err) {
    logErr("notif_trainer_attendance", err);
  }

  revalidatePath(`/t`);
  return { ok: true, data };
}

/**
 * Sprint 35 — bulk-mark every athlete in a session as present in one call.
 * Skips members that already have an attendance mark.
 */
export async function markAllPresentAsTrainer(input: {
  tenant_id: string;
  session_id: string;
}): Promise<ActionResult<{ updated: number }>> {
  const tenantId = input?.tenant_id;
  const sessionId = input?.session_id;
  if (typeof tenantId !== "string" || typeof sessionId !== "string") {
    return fail("Ongeldige invoer");
  }
  const user = await requireAuth();
  const auth = await trainerInSessionGroup(tenantId, user.id, sessionId);
  if (!auth) return fail("Geen toegang.");

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("training_attendance")
    .select("id, attendance")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId);

  const toUpdate = ((rows ?? []) as Array<{ id: string; attendance: string | null }>)
    .filter((r) => !r.attendance)
    .map((r) => r.id);
  if (toUpdate.length === 0) return { ok: true, data: { updated: 0 } };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("training_attendance")
    .update({
      attendance: "present",
      attendance_at: now,
      attendance_by_user_id: user.id,
    })
    .in("id", toUpdate);
  if (error) return fail(error.message);
  return { ok: true, data: { updated: toUpdate.length } };
}

/**
 * Sprint 35 — create a member observation (LVS).
 */
export async function createMemberObservationAsTrainer(
  input: CreateObservationInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createObservationSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await requireAuth();
  const admin = createAdminClient();

  // Tenant fence — target member must belong to this tenant.
  const { data: target } = await admin
    .from("members")
    .select("id")
    .eq("id", parsed.data.member_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!target) return fail("Lid niet gevonden.");

  // Tenant fence — optional session must also belong to this tenant.
  if (parsed.data.session_id) {
    const { data: sess } = await admin
      .from("training_sessions")
      .select("id")
      .eq("id", parsed.data.session_id)
      .eq("tenant_id", parsed.data.tenant_id)
      .maybeSingle();
    if (!sess) return fail("Training niet gevonden.");
  }

  // Authorization: trainer in any group the member belongs to.
  const { data: gms } = await admin
    .from("group_members")
    .select("group_id")
    .eq("member_id", parsed.data.member_id);
  const groupIds = ((gms ?? []) as Array<{ group_id: string }>).map((r) => r.group_id);
  if (groupIds.length === 0) return fail("Geen toegang.");

  const { data: own } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("user_id", user.id);
  const ownIds = ((own ?? []) as Array<{ id: string }>).map((m) => m.id);
  if (ownIds.length === 0) return fail("Geen toegang.");

  const { data: trainerGm } = await admin
    .from("group_members")
    .select("member_id, group_id")
    .in("member_id", ownIds)
    .in("group_id", groupIds);
  const trainerCandidates = ((trainerGm ?? []) as Array<{
    member_id: string;
    group_id: string;
  }>).map((r) => r.member_id);
  if (trainerCandidates.length === 0) return fail("Geen toegang.");

  const [{ data: roleRows }, { data: tmrRows }] = await Promise.all([
    admin
      .from("member_roles")
      .select("member_id")
      .in("member_id", trainerCandidates)
      .eq("role", "trainer"),
    admin
      .from("tenant_member_roles")
      .select("member_id, tenant_roles!inner(is_trainer_role)")
      .eq("tenant_id", parsed.data.tenant_id)
      .in("member_id", trainerCandidates),
  ]);
  let isTrainer = ((roleRows ?? []) as Array<{ member_id: string }>).length > 0;
  if (!isTrainer) {
    type TmrRow = {
      member_id: string;
      tenant_roles:
        | { is_trainer_role: boolean }
        | { is_trainer_role: boolean }[]
        | null;
    };
    for (const r of (tmrRows ?? []) as TmrRow[]) {
      const list = Array.isArray(r.tenant_roles)
        ? r.tenant_roles
        : r.tenant_roles
          ? [r.tenant_roles]
          : [];
      if (list.some((tr) => tr.is_trainer_role)) {
        isTrainer = true;
        break;
      }
    }
  }
  if (!isTrainer) return fail("Geen toegang.");

  const { data, error } = await admin
    .from("member_observations")
    .insert({
      tenant_id: parsed.data.tenant_id,
      member_id: parsed.data.member_id,
      author_user_id: user.id,
      session_id: parsed.data.session_id ?? null,
      body: parsed.data.body,
      visibility: parsed.data.visibility,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Kon notitie niet opslaan.");

  revalidatePath(`/t`);
  return { ok: true, data };
}
