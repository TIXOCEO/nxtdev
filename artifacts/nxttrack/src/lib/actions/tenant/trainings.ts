"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { sendNotification } from "@/lib/notifications/send-notification";
import { getNotificationEvent } from "@/lib/db/notifications";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import {
  createTrainingSessionSchema,
  updateTrainingStatusSchema,
  setAttendanceSchema,
  type CreateTrainingSessionInput,
  type UpdateTrainingStatusInput,
  type SetAttendanceInput,
} from "@/lib/validation/trainings";
import type { TrainingSession } from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

function logErr(tag: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[trainings] ${tag}:`, err instanceof Error ? err.message : err);
}

function fmtDateNL(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── 1. Create training session ────────────────────────────

export async function createTrainingSession(
  input: CreateTrainingSessionInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTrainingSessionSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();
  const admin = createAdminClient();

  // Verify the group belongs to this tenant.
  const { data: g } = await supabase
    .from("groups")
    .select("id")
    .eq("id", parsed.data.group_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!g) return fail("Groep niet gevonden.");

  const { data: created, error } = await supabase
    .from("training_sessions")
    .insert({
      tenant_id: parsed.data.tenant_id,
      group_id: parsed.data.group_id,
      title: parsed.data.title,
      description: parsed.data.description,
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at,
      location: parsed.data.location,
      created_by: user.id,
      status: "scheduled",
    })
    .select("id")
    .single();
  if (error || !created) return fail(error?.message ?? "Kon training niet aanmaken.");

  // Auto-create attendance rows for current group members.
  const { data: gm } = await admin
    .from("group_members")
    .select("member_id")
    .eq("group_id", parsed.data.group_id);
  const memberIds = ((gm ?? []) as Array<{ member_id: string }>).map((r) => r.member_id);
  if (memberIds.length > 0) {
    const rows = memberIds.map((mid) => ({
      tenant_id: parsed.data.tenant_id,
      session_id: created.id,
      member_id: mid,
    }));
    await admin
      .from("training_attendance")
      .upsert(rows, { onConflict: "session_id,member_id" });
  }

  // Notification trigger — training_created.
  try {
    const evt = await getNotificationEvent(parsed.data.tenant_id, "training_created");
    if (!evt || evt.template_enabled) {
      const when = fmtDateNL(parsed.data.starts_at);
      const t = await getTenantTerminology(parsed.data.tenant_id);
      const sessionLower = t.session_singular.charAt(0).toLowerCase() + t.session_singular.slice(1);
      await sendNotification({
        tenantId: parsed.data.tenant_id,
        title: `Nieuwe ${sessionLower}: ${parsed.data.title}`,
        contentText: `${parsed.data.title} — ${when}${
          parsed.data.location ? ` · ${parsed.data.location}` : ""
        }`,
        contentHtml: `<p><strong>${parsed.data.title}</strong><br/>${when}${
          parsed.data.location ? ` · ${parsed.data.location}` : ""
        }</p>`,
        targets: [{ target_type: "group", target_id: parsed.data.group_id }],
        sendEmail: evt?.email_enabled ?? false,
        source: "training_created",
        sourceRef: created.id,
        createdBy: user.id,
      });
    }
  } catch (err) {
    logErr("notif_training_created", err);
  }

  revalidatePath("/tenant/trainings");
  return { ok: true, data: { id: created.id } };
}

// ── 2. Update status (cancel/complete) ────────────────────

export async function updateTrainingStatus(
  input: UpdateTrainingStatusInput,
): Promise<ActionResult<TrainingSession>> {
  const parsed = updateTrainingStatusSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("training_sessions")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.session_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .select()
    .single();
  if (error || !data) return fail(error?.message ?? "Kon status niet bijwerken.");

  revalidatePath("/tenant/trainings");
  revalidatePath(`/tenant/trainings/${parsed.data.session_id}`);
  return { ok: true, data: data as TrainingSession };
}

// ── 3. Trainer marks attendance ───────────────────────────

export async function setAttendance(
  input: SetAttendanceInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = setAttendanceSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();

  // Verify session + member belong to tenant.
  const { data: s } = await admin
    .from("training_sessions")
    .select("id, group_id")
    .eq("id", parsed.data.session_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!s) return fail("Training niet gevonden.");

  const { data: m } = await admin
    .from("members")
    .select("id")
    .eq("id", parsed.data.member_id)
    .eq("tenant_id", parsed.data.tenant_id)
    .maybeSingle();
  if (!m) return fail("Lid niet gevonden.");

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
        // Keep legacy columns in sync for one release.
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

  // Notify the affected member (or their parents) of the trainer mark.
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
        sourceRef: parsed.data.session_id,
        createdBy: user.id,
      });
    }
  } catch (err) {
    logErr("notif_trainer_attendance", err);
  }

  revalidatePath(`/tenant/trainings/${parsed.data.session_id}`);
  revalidatePath(`/tenant/trainings/${parsed.data.session_id}/attendance`);
  return { ok: true, data };
}

// ── 4. Send manual reminder for a session ─────────────────

export async function sendTrainingReminder(input: {
  tenant_id: string;
  session_id: string;
}): Promise<ActionResult<{ recipientCount: number }>> {
  if (
    !input ||
    typeof input.tenant_id !== "string" ||
    typeof input.session_id !== "string"
  ) {
    return fail("Ongeldige invoer");
  }

  const user = await assertTenantAccess(input.tenant_id);
  const admin = createAdminClient();

  const { data: s } = await admin
    .from("training_sessions")
    .select("id, group_id, title, starts_at, location")
    .eq("id", input.session_id)
    .eq("tenant_id", input.tenant_id)
    .maybeSingle();
  if (!s) return fail("Training niet gevonden.");

  const session = s as Pick<
    TrainingSession,
    "id" | "group_id" | "title" | "starts_at" | "location"
  >;

  try {
    const evt = await getNotificationEvent(input.tenant_id, "training_reminder");
    const when = fmtDateNL(session.starts_at);
    const t = await getTenantTerminology(input.tenant_id);
    const sessionLower =
      t.session_singular.charAt(0).toLowerCase() + t.session_singular.slice(1);
    const result = await sendNotification({
      tenantId: input.tenant_id,
      title: `Herinnering ${sessionLower}: ${session.title}`,
      contentText: `Vergeet je aanwezigheid niet door te geven voor ${when}.`,
      contentHtml: `<p>Vergeet je aanwezigheid niet door te geven voor <strong>${when}</strong>${
        session.location ? ` · ${session.location}` : ""
      }.</p>`,
      targets: [{ target_type: "group", target_id: session.group_id }],
      sendEmail: evt?.email_enabled ?? false,
      source: "training_reminder",
      sourceRef: session.id,
      createdBy: user.id,
    });
    revalidatePath(`/tenant/trainings/${session.id}`);
    return { ok: true, data: { recipientCount: result.recipientCount } };
  } catch (err) {
    logErr("notif_reminder", err);
    return fail(err instanceof Error ? err.message : "Kon herinnering niet versturen.");
  }
}
