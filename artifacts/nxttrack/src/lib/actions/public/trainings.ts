"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { sendNotification } from "@/lib/notifications/send-notification";
import { getNotificationEvent } from "@/lib/db/notifications";
import { getTenantTerminology } from "@/lib/terminology/resolver";
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

  // Sprint 35 — late notification only goes to trainers of the *specific*
  // group (intersection of group_members + trainer roles), not every
  // tenant-wide trainer.
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

        const { data: gmRows } = await admin
          .from("group_members")
          .select("member_id")
          .eq("group_id", session.group_id);
        const groupMemberIds = ((gmRows ?? []) as Array<{ member_id: string }>).map(
          (r) => r.member_id,
        );
        const trainerIds = new Set<string>();
        if (groupMemberIds.length > 0) {
          const [{ data: roleRows }, { data: tmrRows }] = await Promise.all([
            admin
              .from("member_roles")
              .select("member_id, role")
              .in("member_id", groupMemberIds)
              .eq("role", "trainer"),
            admin
              .from("tenant_member_roles")
              .select("member_id, tenant_roles!inner(is_trainer_role)")
              .eq("tenant_id", parsed.data.tenant_id)
              .in("member_id", groupMemberIds),
          ]);
          for (const r of (roleRows ?? []) as Array<{ member_id: string }>) {
            trainerIds.add(r.member_id);
          }
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
              trainerIds.add(r.member_id);
            }
          }
        }
        const targets = Array.from(trainerIds).map((id) => ({
          target_type: "member" as const,
          target_id: id,
        }));
        if (targets.length > 0) {
          const term = await getTenantTerminology(parsed.data.tenant_id);
          const sessionLower =
            term.session_singular.charAt(0).toLowerCase() +
            term.session_singular.slice(1);
          await sendNotification({
            tenantId: parsed.data.tenant_id,
            title: `Late wijziging ${sessionLower}: ${session.title}`,
            contentText: `Reactie binnen de cutoff: ${labels[parsed.data.rsvp]}.`,
            targets,
            sendEmail: evt?.email_enabled ?? false,
            source: "attendance_changed_late",
            // Sprint 43 — use the training_attendance row id so the
            // idempotency key is unique per (member, session). Using
            // session.id alone would dedupe legitimate notifications for
            // *other* members reacting late to the same session.
            sourceRef: data.id,
            createdBy: user.id,
          });
        }
      }
    } catch (err) {
      logErr("notif_late", err);
    }
  }

  return { ok: true, data: { id: data.id, late: isLate } };
}
