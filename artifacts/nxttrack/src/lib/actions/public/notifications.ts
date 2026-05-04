"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-auth";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const markSchema = z.object({
  recipient_id: z.string().uuid(),
  slug: z.string().min(1),
});

/**
 * Sprint 13 — flag a single inbox row as read for the current user.
 * RLS policy `notif_recipients_self_*` ensures we can only update our own.
 */
export async function markRecipientRead(
  input: z.infer<typeof markSchema>,
): Promise<ActionResult<void>> {
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_recipients")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", parsed.data.recipient_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/t/${parsed.data.slug}/notifications`);
  return { ok: true, data: undefined };
}
