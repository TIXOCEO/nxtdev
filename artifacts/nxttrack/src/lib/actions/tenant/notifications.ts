"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { assertTenantAccess } from "./_assert-access";
import {
  createNotificationSchema,
  type CreateNotificationInput,
} from "@/lib/validation/notifications";
import { sendNotification } from "@/lib/notifications/send-notification";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<ActionResult<{ id: string; recipientCount: number; emailsSent: number }>> {
  const parsed = createNotificationSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);

  try {
    const result = await sendNotification({
      tenantId: parsed.data.tenant_id,
      title: parsed.data.title,
      contentHtml: parsed.data.content_html ?? null,
      contentText: parsed.data.content_text ?? null,
      targets: parsed.data.targets,
      sendEmail: parsed.data.send_email,
      source: "manual",
      createdBy: user.id,
    });
    revalidatePath("/tenant/notifications");
    return {
      ok: true,
      data: {
        id: result.notificationId,
        recipientCount: result.recipientCount,
        emailsSent: result.emailsSent,
      },
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Versturen mislukt.");
  }
}

export async function markNotificationRead(
  recipientId: string,
): Promise<ActionResult<{ id: string }>> {
  if (!/^[0-9a-f-]{36}$/i.test(recipientId)) return fail("Ongeldig id.");
  const user = await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_recipients")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", recipientId)
    .eq("user_id", user.id);
  if (error) return fail(error.message);
  return { ok: true, data: { id: recipientId } };
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ updated: number }>> {
  const user = await requireAuth();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_recipients")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .select("id");
  if (error) return fail(error.message);
  return { ok: true, data: { updated: (data ?? []).length } };
}

export async function getMyNotificationFeed(): Promise<
  ActionResult<{
    items: Array<{
      recipient_id: string;
      notification_id: string;
      title: string;
      content_html: string | null;
      content_text: string | null;
      is_read: boolean;
      created_at: string;
    }>;
    unread: number;
  }>
> {
  const user = await requireAuth();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_recipients")
    .select(
      "id, notification_id, is_read, read_at, created_at, notifications!inner(id, title, content_html, content_text)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return fail(error.message);

  type NestedNotif = {
    id: string;
    title: string;
    content_html: string | null;
    content_text: string | null;
  };
  type Row = {
    id: string;
    notification_id: string;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    notifications: NestedNotif | NestedNotif[];
  };
  const items = ((data ?? []) as unknown as Row[]).map((row) => {
    const n = Array.isArray(row.notifications) ? row.notifications[0] : row.notifications;
    return {
      recipient_id: row.id,
      notification_id: row.notification_id,
      title: n?.title ?? "",
      content_html: n?.content_html ?? null,
      content_text: n?.content_text ?? null,
      is_read: row.is_read,
      created_at: row.created_at,
    };
  });
  const unread = items.filter((i) => !i.is_read).length;
  return { ok: true, data: { items, unread } };
}
