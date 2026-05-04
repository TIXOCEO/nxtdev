import "server-only";
import webpush, { type WebPushError } from "web-push";
import {
  deactivateSubscription,
  getActiveSubscriptionsForUsers,
  getResolvedPushPolicy,
  isEventPushAllowed,
} from "@/lib/db/push";

function logErr(tag: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(
    `[push] ${tag}:`,
    err instanceof Error ? err.message : err,
  );
}

export interface SendPushParams {
  tenantId: string;
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  /** Maps to notification_events.event_key (e.g. "training_created"). */
  eventKey?: string | null;
}

export interface SendPushResult {
  attempted: number;
  delivered: number;
  invalidated: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Sprint 13 — fan-out web-push for an in-app notification.
 *
 * Best-effort, runs after the in-app insert. Will silently no-op if VAPID
 * isn't configured yet, the tenant disabled push, or the event key is
 * blocked. Invalid endpoints (410/404) are deactivated.
 */
export async function sendPushNotification(
  params: SendPushParams,
): Promise<SendPushResult> {
  if (params.userIds.length === 0) {
    return { attempted: 0, delivered: 0, invalidated: 0, skipped: true, reason: "no_users" };
  }

  const policy = await getResolvedPushPolicy(params.tenantId);
  if (!policy) {
    return { attempted: 0, delivered: 0, invalidated: 0, skipped: true, reason: "no_platform_settings" };
  }
  if (!policy.vapid_public_key || !policy.vapid_private_key) {
    return { attempted: 0, delivered: 0, invalidated: 0, skipped: true, reason: "no_vapid" };
  }
  if (!isEventPushAllowed(policy, params.eventKey ?? null)) {
    return { attempted: 0, delivered: 0, invalidated: 0, skipped: true, reason: "event_disabled" };
  }

  webpush.setVapidDetails(
    policy.vapid_subject,
    policy.vapid_public_key,
    policy.vapid_private_key,
  );

  const subs = await getActiveSubscriptionsForUsers(params.userIds);
  if (subs.length === 0) {
    return { attempted: 0, delivered: 0, invalidated: 0, skipped: true, reason: "no_subs" };
  }

  const payload = JSON.stringify({
    title: params.title,
    body: params.body,
    url: params.url ?? "/",
  });

  let delivered = 0;
  let invalidated = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          payload,
          { TTL: 60 * 60 },
        );
        delivered += 1;
      } catch (err) {
        const e = err as WebPushError;
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await deactivateSubscription(s.id).catch(() => undefined);
          invalidated += 1;
        } else {
          logErr("send_failed", err);
        }
      }
    }),
  );

  return { attempted: subs.length, delivered, invalidated, skipped: false };
}
