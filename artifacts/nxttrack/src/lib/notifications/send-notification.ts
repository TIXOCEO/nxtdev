import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { sendPushNotification } from "@/lib/push/send-push";
import { getOptedOutUsers } from "@/lib/db/notification-prefs";
import { resolveRecipients, type ResolveTarget } from "./resolve-recipients";

function logErr(tag: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(
    `[notifications] ${tag}:`,
    err instanceof Error ? err.message : err,
  );
}

export interface SendNotificationParams {
  tenantId: string;
  title: string;
  contentHtml?: string | null;
  contentText?: string | null;
  targets: ResolveTarget[];
  sendEmail?: boolean;
  /** Sprint 13: optional web-push fan-out (best-effort, like email). */
  sendPush?: boolean;
  /** Sprint 13: deep-link target opened from the notification toast. */
  pushUrl?: string | null;
  source?: string | null;
  sourceRef?: string | null;
  createdBy?: string | null;
}

export interface SendNotificationResult {
  notificationId: string;
  recipientCount: number;
  emailsAttempted: number;
  emailsSent: number;
  /** Sprint 13. */
  pushAttempted: number;
  pushDelivered: number;
}

/**
 * Sprint 12 — atomic notification creation via RPC.
 *
 * Pre-resolves recipients in TS, then performs a single transactional
 * RPC call (notification + targets + recipients). Email fan-out remains
 * outside the transaction (best-effort).
 *
 * Caller MUST already have asserted tenant access.
 */
export async function sendNotification(
  params: SendNotificationParams,
): Promise<SendNotificationResult> {
  const admin = createAdminClient();

  // 1. Resolve recipients up front so they can be passed atomically.
  const resolved = await resolveRecipients(params.tenantId, params.targets);

  // 2. Single atomic RPC — notification + targets + recipients.
  const targetsJson = params.targets.map((t) => ({
    target_type: t.target_type,
    target_id: t.target_type === "all" ? null : (t.target_id ?? null),
  }));
  const recipientsJson = resolved.map((r) => ({
    member_id: r.member_id,
    user_id: r.user_id,
  }));

  const { data: notifId, error: rpcErr } = await admin.rpc(
    "create_notification_with_recipients",
    {
      p_tenant_id: params.tenantId,
      p_title: params.title,
      p_content_html: params.contentHtml ?? null,
      p_content_text: params.contentText ?? null,
      p_source: params.source ?? "manual",
      p_source_ref: params.sourceRef ?? null,
      p_created_by: params.createdBy ?? null,
      p_targets: targetsJson,
      p_recipients: recipientsJson,
    },
  );

  if (rpcErr || !notifId) {
    throw new Error(rpcErr?.message ?? "Failed to create notification.");
  }
  const notificationId = notifId as unknown as string;

  // 3. Optional email fan-out (best-effort).
  let emailsAttempted = 0;
  let emailsSent = 0;
  if (params.sendEmail && resolved.length > 0) {
    // Sprint 14 — honor user-level email opt-outs.
    const userIdsForPrefs = Array.from(
      new Set(resolved.map((r) => r.user_id).filter((u): u is string => !!u)),
    );
    const optedOutEmail = await getOptedOutUsers(
      params.tenantId,
      params.source ?? null,
      "email",
      userIdsForPrefs,
    );

    const [{ data: tenant }, { data: members }] = await Promise.all([
      admin.from("tenants").select("name").eq("id", params.tenantId).maybeSingle(),
      admin
        .from("members")
        .select("id, full_name, email")
        .eq("tenant_id", params.tenantId)
        .in(
          "id",
          resolved.map((r) => r.member_id),
        ),
    ]);
    const tenantName = (tenant?.name as string | undefined) ?? "";
    const memberMap = new Map(
      ((members ?? []) as Array<{ id: string; full_name: string; email: string | null }>).map(
        (m) => [m.id, m],
      ),
    );

    const plainContent =
      params.contentText ??
      (params.contentHtml ? params.contentHtml.replace(/<[^>]*>/g, "").trim() : "");

    for (const r of resolved) {
      const member = memberMap.get(r.member_id);
      if (!member?.email) continue;
      if (r.user_id && optedOutEmail.has(r.user_id)) continue;
      emailsAttempted++;
      try {
        const res = await sendEmail({
          tenantId: params.tenantId,
          templateKey: "notification",
          to: member.email,
          variables: {
            member_name: member.full_name ?? "",
            tenant_name: tenantName,
            notification_title: params.title,
            notification_content: plainContent,
            news_title: params.title,
          },
          triggerSource: `notification:${params.source ?? "manual"}`,
        });
        if (res.ok) emailsSent++;
      } catch (err) {
        logErr("notification_email_failed", err);
      }
    }

    if (emailsAttempted > 0) {
      await admin
        .from("notifications")
        .update({ email_sent: emailsSent > 0 })
        .eq("id", notificationId);
    }
  }

  // 4. Optional web-push fan-out (best-effort).
  let pushAttempted = 0;
  let pushDelivered = 0;
  if (params.sendPush && resolved.length > 0) {
    try {
      const allUserIds = Array.from(
        new Set(resolved.map((r) => r.user_id).filter((u): u is string => !!u)),
      );
      // Sprint 14 — honor user-level push opt-outs.
      const optedOutPush = await getOptedOutUsers(
        params.tenantId,
        params.source ?? null,
        "push",
        allUserIds,
      );
      const userIds = allUserIds.filter((u) => !optedOutPush.has(u));
      const plain =
        params.contentText ??
        (params.contentHtml ? params.contentHtml.replace(/<[^>]*>/g, "").trim() : "");
      const res = await sendPushNotification({
        tenantId: params.tenantId,
        userIds,
        title: params.title,
        body: plain.slice(0, 200),
        url: params.pushUrl ?? "/",
        eventKey: params.source ?? null,
      });
      pushAttempted = res.attempted;
      pushDelivered = res.delivered;
    } catch (err) {
      logErr("notification_push_failed", err);
    }
  }

  return {
    notificationId,
    recipientCount: resolved.length,
    emailsAttempted,
    emailsSent,
    pushAttempted,
    pushDelivered,
  };
}
