import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type NotificationChannel = "email" | "push";

export interface UserNotificationPreference {
  id: string;
  user_id: string;
  tenant_id: string;
  event_key: string;
  channel: NotificationChannel;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** All preference rows for the current user in a tenant (RLS scoped). */
export async function getMyNotificationPrefs(
  tenantId: string,
): Promise<UserNotificationPreference[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_notification_preferences")
    .select("*")
    .eq("tenant_id", tenantId);
  return (data ?? []) as UserNotificationPreference[];
}

/**
 * Returns the user_ids (subset of `userIds`) that have explicitly opted OUT
 * of the given (event_key, channel) for this tenant. Used by the send
 * pipelines to skip those recipients.
 */
export async function getOptedOutUsers(
  tenantId: string,
  eventKey: string | null | undefined,
  channel: NotificationChannel,
  userIds: string[],
): Promise<Set<string>> {
  if (!eventKey || userIds.length === 0) return new Set();
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_notification_preferences")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("event_key", eventKey)
    .eq("channel", channel)
    .eq("enabled", false)
    .in("user_id", userIds);
  return new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
}
