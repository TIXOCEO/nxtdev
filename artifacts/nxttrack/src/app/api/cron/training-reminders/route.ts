import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications/send-notification";
import { getNotificationEvent } from "@/lib/db/notifications";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { getTrainingSettingsResolved } from "@/lib/db/training-settings";
import type { TrainingSession, Tenant } from "@/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sprint 35 — Auto-reminder cron endpoint.
 *
 * Triggered hourly by the api-server worker (or any external scheduler).
 *
 * Per tenant:
 *   1. Read `tenant_training_settings.reminder_hours_before` (default 24).
 *   2. Find scheduled sessions starting between now and now + Hh whose
 *      `reminder_run_at` is null.
 *   3. Send `training_reminder` to the group; mark session.reminder_run_at
 *      and (per attendance row) reminder_sent_at = now. All updates are
 *      idempotent — calling again is a no-op.
 *
 * Auth: requires `x-cron-secret` header matching env `CRON_SECRET`. When
 * `CRON_SECRET` is unset (dev), the endpoint is open.
 */
export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = req.headers.get("x-cron-secret");
    if (got !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const { data: tenants } = await admin
    .from("tenants")
    .select("id, name, slug, status");
  const list = ((tenants ?? []) as Pick<Tenant, "id" | "name" | "slug" | "status">[]).filter(
    (t) => t.status === "active",
  );

  const summary: Array<{ tenantId: string; sent: number; sessions: number }> = [];
  const now = new Date();

  for (const t of list) {
    const settings = await getTrainingSettingsResolved(t.id);
    const horizon = new Date(
      now.getTime() + settings.reminder_hours_before * 60 * 60 * 1000,
    );

    // Atomic claim: flip reminder_run_at on candidate rows in a single
    // statement so concurrent invocations cannot double-send. Each row
    // returned is "owned" by this run.
    const stamp = new Date().toISOString();
    const { data: claimed } = await admin
      .from("training_sessions")
      .update({ reminder_run_at: stamp })
      .eq("tenant_id", t.id)
      .eq("status", "scheduled")
      .is("reminder_run_at", null)
      .gte("starts_at", now.toISOString())
      .lte("starts_at", horizon.toISOString())
      .select("id, group_id, title, starts_at, location");
    const sessions = (claimed ?? []) as Array<
      Pick<TrainingSession, "id" | "group_id" | "title" | "starts_at" | "location">
    >;

    let sent = 0;
    for (const s of sessions) {
      try {
        const evt = await getNotificationEvent(t.id, "training_reminder");
        if (evt && !evt.template_enabled) {
          // Already claimed; nothing further to do.
          continue;
        }
        const when = new Date(s.starts_at).toLocaleString("nl-NL", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        const term = await getTenantTerminology(t.id);
        const sessionLower =
          term.session_singular.charAt(0).toLowerCase() +
          term.session_singular.slice(1);
        await sendNotification({
          tenantId: t.id,
          title: `Herinnering ${sessionLower}: ${s.title}`,
          contentText: `${when}${s.location ? ` · ${s.location}` : ""}`,
          contentHtml: `<p>${when}${s.location ? ` · ${s.location}` : ""}</p>`,
          targets: [{ target_type: "group", target_id: s.group_id }],
          sendEmail: evt?.email_enabled ?? false,
          source: "training_reminder",
          sourceRef: s.id,
        });
        sent++;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[cron training-reminders] send failed", s.id, err);
      } finally {
        await admin
          .from("training_attendance")
          .update({ reminder_sent_at: stamp })
          .eq("session_id", s.id)
          .is("reminder_sent_at", null);
      }
    }

    summary.push({ tenantId: t.id, sessions: sessions.length, sent });
  }

  return NextResponse.json({ ok: true, summary });
}

export async function GET() {
  // GET is intentionally not allowed — only POST with x-cron-secret may
  // trigger reminders, to avoid accidental browser-prefetch firing.
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
