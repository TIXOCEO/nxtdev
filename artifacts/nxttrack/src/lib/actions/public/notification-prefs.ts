"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth/get-user";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const schema = z.object({
  tenant_id: z.string().uuid(),
  event_key: z.string().min(1).max(80),
  channel: z.enum(["email", "push"]),
  enabled: z.boolean(),
  slug: z.string().min(1).max(120),
});

/**
 * Upsert one (event_key, channel) preference for the current user.
 * RLS would also allow this; we use the admin client so we can perform a
 * single onConflict upsert.
 */
export async function setNotificationPreference(
  input: z.infer<typeof schema>,
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_notification_preferences")
    .upsert(
      {
        user_id: user.id,
        tenant_id: parsed.data.tenant_id,
        event_key: parsed.data.event_key,
        channel: parsed.data.channel,
        enabled: parsed.data.enabled,
      },
      { onConflict: "user_id,tenant_id,event_key,channel" },
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/t/${parsed.data.slug}/instellingen`);
  return { ok: true, data: undefined };
}
