"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { sendNotification } from "@/lib/notifications/send-notification";
import { getNotificationEvent } from "@/lib/db/notifications";
import { getTrainingSettingsResolved } from "@/lib/db/training-settings";
import { setRsvpSchema, type SetRsvpInput } from "@/lib/validation/trainings";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

function logErr(tag: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[public/trainings] ${tag}:`, err instanceof Error ? err.message : err);
}

/**
 * Public-side RSVP. Authenticated user; we verify the user is allowed to
 * answer for the member (own member or linked parent of a child member).
 *
 * If the response is "late" (within `late_response_hours` of session start)
 * AND the caller didn't confirm, the action returns a `late_required` error
 * for the UI to confirm with a second submit.
 *
 * Late updates fire `attendance_changed_late` notifications to trainers.
 */
export async function setMyRsvp(
  input: SetRsvpInput,
): Promise<ActionResult<{ id: string; late: boolean }>> {
  const parsed = setRsvpSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await requireAuth();
  const admin = createAdminClient();

  // Verify member belongs to tenant + the user is allowed to answer for them.
  const { data: m } = await admin
    .from("members")
    .select("id, tenant_id, user_id")
    .eq("id", parsed.data.member_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!m) return fail("Lid niet gevonden.");
  const member = m as { id: string; tenant_id: string; user_id: string | null };

  let allowed = member.user_id === user.id;
  if (!allowed) {
    // Check parent link: user owns a parent member that links to this child.
    const { data: links } = await admin
      .from("member_links")
      .select("parent_member_id")
      .eq("tenant_id", parsed.data.tenant_id)
      .eq("child_member_id", parsed.data.member_id);
    const parentIds = ((links ?? []) as Array<{ parent_member_id: string }>).map(
      (l) => l.parent_member_id,
    );
    if (parentIds.length > 0) {
      const { data: parents } = await admin
        .from("members")
        .select("id, user_id")
        .in("id", parentIds)
        .eq("user_id", user.id);
      allowed = (parents ?? []).length > 0;
    }
  }
  if (!allowed) return fail("Geen toegang tot deze inschrijving.");

  // Verify session exists in tenant + check late cutoff.
  const { data: s } = await admin
    .from("training_sessions")
    .select("id, group_id, title, starts_at, status")
    .eq("id", parsed.data.session_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!s) return fail("Training niet gevonden.");
  const session = s as {
    id: string;
    group_id: string;
    title: string;
    starts_at: string;
    status: string;
  };
  if (session.status !== "scheduled") {
    return fail("Deze training accepteert geen reacties meer.");
  }

  const settings = await getTrainingSettingsResolved(parsed.data.tenant_id);
  const hoursUntil =
    (Date.parse(session.starts_at) - Date.now()) / (60 * 60 * 1000);
  const isLate = hoursUntil <= settings.late_response_hours;

  if (isLate && !parsed.data.confirm_late) {
    return fail("late_required");
  }

  const isAbsent = parsed.data.rsvp === "not_attending";
  const { data, error } = await admin
    .from("training_attendance")
    .upsert(
      {
        tenant_id: parsed.data.tenant_id,
        session_id: parsed.data.session_id,
        member_id: parsed.data.member_id,
        rsvp: parsed.data.rsvp,
        rsvp_at: new Date().toISOString(),
        rsvp_by_user_id: user.id,
        rsvp_late: isLate,
        absence_reason: isAbsent ? (parsed.data.absence_reason ?? null) : null,
        attendance_reason: isAbsent ? (parsed.data.attendance_reason ?? null) : null,
      },
      { onConflict: "session_id,member_id" },
    )
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Kon reactie niet opslaan.");

  // Late notification to trainers (group target → role='trainer'-only-aware
  // is not supported; we just notify the group's trainers via role target).
  if (isLate && settings.notify_trainer_on_late) {
    try {
      const evt = await getNotificationEvent(
        parsed.data.tenant_id,
        "attendance_changed_late",
      );
      if (!evt || evt.template_enabled) {
        const labels: Record<string, string> = {
          attending: "Aanwezig",
          not_attending: "Afwezig",
          maybe: "Misschien",
        };
        await sendNotification({
          tenantId: parsed.data.tenant_id,
          title: `Late wijziging: ${session.title}`,
          contentText: `Reactie binnen de cutoff: ${labels[parsed.data.rsvp]}.`,
          targets: [{ target_type: "role", target_id: "trainer" }],
          sendEmail: evt?.email_enabled ?? false,
          source: "attendance_changed_late",
          sourceRef: session.id,
          createdBy: user.id,
        });
      }
    } catch (err) {
      logErr("notif_late", err);
    }
  }

  return { ok: true, data: { id: data.id, late: isLate } };
}
