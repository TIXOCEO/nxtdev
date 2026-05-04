"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/require-auth";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const subscribeSchema = z.object({
  tenant_id: z.string().uuid(),
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  user_agent: z.string().max(500).nullish(),
});

export type SubscribePushInput = z.infer<typeof subscribeSchema>;

/**
 * Sprint 13 — store/refresh a browser push subscription for the current
 * user in the given tenant. Tenant access is enforced by RLS via the
 * authenticated client (push_subscriptions has policies for self_all and
 * tenant_all).
 */
export async function subscribePush(
  input: SubscribePushInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };

  const user = await requireAuth();
  const admin = createAdminClient();

  // Verify the user has at least one member row in the tenant.
  const { data: m } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!m) return { ok: false, error: "Geen toegang." };

  const { data, error } = await admin
    .from("push_subscriptions")
    .upsert(
      {
        tenant_id: parsed.data.tenant_id,
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        user_agent: parsed.data.user_agent ?? null,
        is_active: true,
      },
      { onConflict: "user_id,endpoint" },
    )
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Mislukt." };
  return { ok: true, data: { id: data.id } };
}

const unsubSchema = z.object({ endpoint: z.string().url() });

export async function unsubscribePush(input: {
  endpoint: string;
}): Promise<ActionResult<void>> {
  const parsed = unsubSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const user = await requireAuth();
  const admin = createAdminClient();
  await admin
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint);
  return { ok: true, data: undefined };
}
