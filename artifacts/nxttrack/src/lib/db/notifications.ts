import { createClient } from "@/lib/supabase/server";
import type { Notification, NotificationEvent, NotificationTarget } from "@/types/database";

export interface NotificationListRow extends Notification {
  recipient_count: number;
  read_count: number;
}

export async function getNotificationsByTenant(
  tenantId: string,
): Promise<NotificationListRow[]> {
  const supabase = await createClient();

  const [{ data: notifs, error: nErr }, { data: recipients }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("notification_recipients")
      .select("notification_id, is_read")
      .eq("tenant_id", tenantId),
  ]);

  if (nErr) throw new Error(`Failed to fetch notifications: ${nErr.message}`);

  const counts = new Map<string, { total: number; read: number }>();
  for (const r of (recipients ?? []) as Array<{
    notification_id: string;
    is_read: boolean;
  }>) {
    const c = counts.get(r.notification_id) ?? { total: 0, read: 0 };
    c.total += 1;
    if (r.is_read) c.read += 1;
    counts.set(r.notification_id, c);
  }

  return ((notifs ?? []) as Notification[]).map((n) => ({
    ...n,
    recipient_count: counts.get(n.id)?.total ?? 0,
    read_count: counts.get(n.id)?.read ?? 0,
  }));
}

export async function getNotificationDetail(
  id: string,
  tenantId: string,
): Promise<{
  notification: Notification;
  targets: NotificationTarget[];
  recipientCount: number;
  readCount: number;
} | null> {
  const supabase = await createClient();
  const { data: n } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!n) return null;
  const [{ data: t }, { data: r }] = await Promise.all([
    supabase.from("notification_targets").select("*").eq("notification_id", id),
    supabase
      .from("notification_recipients")
      .select("is_read")
      .eq("notification_id", id),
  ]);
  const recipients = (r ?? []) as Array<{ is_read: boolean }>;
  return {
    notification: n as Notification,
    targets: (t ?? []) as NotificationTarget[],
    recipientCount: recipients.length,
    readCount: recipients.filter((x) => x.is_read).length,
  };
}

export interface InboxRow {
  recipient_id: string;
  notification_id: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  notification: Notification;
}

/**
 * Reads the current user's inbox. Relies on the
 * `notif_recipients_self_read` RLS policy so callers don't need elevated
 * privileges.
 */
export async function getMyNotifications(limit = 30): Promise<InboxRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_recipients")
    .select(
      "id, notification_id, is_read, read_at, created_at, notifications!inner(*)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  type Row = {
    id: string;
    notification_id: string;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    notifications: Notification | Notification[];
  };
  return ((data ?? []) as unknown as Row[])
    .map((row) => {
      const n = Array.isArray(row.notifications) ? row.notifications[0] : row.notifications;
      if (!n) return null;
      return {
        recipient_id: row.id,
        notification_id: row.notification_id,
        is_read: row.is_read,
        read_at: row.read_at,
        created_at: row.created_at,
        notification: n,
      };
    })
    .filter((r): r is InboxRow => r !== null);
}

export async function getMyUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notification_recipients")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  return count ?? 0;
}

export async function getNotificationEvent(
  tenantId: string,
  eventKey: string,
): Promise<NotificationEvent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("event_key", eventKey)
    .maybeSingle();
  return (data as NotificationEvent | null) ?? null;
}

export async function getNotificationEventsByTenant(
  tenantId: string,
): Promise<NotificationEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("event_key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationEvent[];
}
