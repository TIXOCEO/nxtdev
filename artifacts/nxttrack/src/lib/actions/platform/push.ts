"use server";

import { revalidatePath } from "next/cache";
import webpush from "web-push";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import type { PlatformPushSettings } from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const SINGLETON_KEY = { singleton: true };

async function fetchOrCreate(): Promise<PlatformPushSettings> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("platform_push_settings")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  if (existing) return existing as PlatformPushSettings;
  const { data: created, error } = await admin
    .from("platform_push_settings")
    .insert(SINGLETON_KEY)
    .select("*")
    .single();
  if (error || !created) throw new Error(error?.message ?? "create failed");
  return created as PlatformPushSettings;
}

/**
 * Generate (or rotate) the VAPID key pair. Existing subscriptions become
 * invalid after rotation — this is a deliberate destructive action.
 */
export async function generateVapidKeys(): Promise<ActionResult<{ publicKey: string }>> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  await fetchOrCreate();
  const keys = webpush.generateVAPIDKeys();
  const { error } = await admin
    .from("platform_push_settings")
    .update({
      vapid_public_key: keys.publicKey,
      vapid_private_key: keys.privateKey,
    })
    .eq("singleton", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/platform/push");
  return { ok: true, data: { publicKey: keys.publicKey } };
}

const settingsSchema = z.object({
  vapid_subject: z
    .string()
    .trim()
    .min(1)
    .refine((s) => s.startsWith("mailto:") || s.startsWith("https://"), {
      message: "Moet beginnen met mailto: of https://",
    }),
  allowed_event_keys: z.array(z.string().min(1).max(80)).max(50),
});

export async function savePlatformPushSettings(
  input: z.infer<typeof settingsSchema>,
): Promise<ActionResult<void>> {
  await requirePlatformAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const admin = createAdminClient();
  await fetchOrCreate();
  const { error } = await admin
    .from("platform_push_settings")
    .update({
      vapid_subject: parsed.data.vapid_subject,
      allowed_event_keys: parsed.data.allowed_event_keys,
    })
    .eq("singleton", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/platform/push");
  return { ok: true, data: undefined };
}
