import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  PlatformPushSettings,
  PushSubscriptionRow,
  TenantPushSettings,
} from "@/types/database";

// ── Platform settings (singleton) ─────────────────────────

export async function getPlatformPushSettings(): Promise<PlatformPushSettings | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_push_settings")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  return (data as PlatformPushSettings | null) ?? null;
}

/** Public (read-only) view used by the browser to subscribe. */
export async function getPlatformPushPublic(): Promise<{
  vapid_public_key: string | null;
  allowed_event_keys: string[];
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_push_settings")
    .select("vapid_public_key, allowed_event_keys")
    .eq("singleton", true)
    .maybeSingle();
  if (!data) return null;
  return data as { vapid_public_key: string | null; allowed_event_keys: string[] };
}

// ── Tenant settings ───────────────────────────────────────

export async function getTenantPushSettings(
  tenantId: string,
): Promise<TenantPushSettings | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant_push_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as TenantPushSettings | null) ?? null;
}

export interface ResolvedPushPolicy {
  push_enabled: boolean;
  default_push_on_manual: boolean;
  event_overrides: Record<string, boolean>;
  allowed_event_keys: string[];
  vapid_public_key: string | null;
  vapid_private_key: string | null;
  vapid_subject: string;
}

/**
 * Combine platform + tenant settings into a single decision record used by
 * send-push.ts. Defaults are safe: push_enabled defaults true at tenant level
 * (so if a tenant never opens settings, push still works); allowed_event_keys
 * empty means "allow everything".
 */
export async function getResolvedPushPolicy(
  tenantId: string,
): Promise<ResolvedPushPolicy | null> {
  const [platform, tenant] = await Promise.all([
    getPlatformPushSettings(),
    getTenantPushSettings(tenantId),
  ]);
  if (!platform) return null;
  return {
    push_enabled: tenant?.push_enabled ?? true,
    default_push_on_manual: tenant?.default_push_on_manual ?? true,
    event_overrides: (tenant?.event_overrides ?? {}) as Record<string, boolean>,
    allowed_event_keys: platform.allowed_event_keys ?? [],
    vapid_public_key: platform.vapid_public_key,
    vapid_private_key: platform.vapid_private_key,
    vapid_subject: platform.vapid_subject,
  };
}

export function isEventPushAllowed(
  policy: ResolvedPushPolicy,
  eventKey: string | null | undefined,
): boolean {
  if (!policy.push_enabled) return false;
  if (
    policy.allowed_event_keys.length > 0 &&
    eventKey &&
    !policy.allowed_event_keys.includes(eventKey)
  ) {
    return false;
  }
  if (eventKey && eventKey in policy.event_overrides) {
    return policy.event_overrides[eventKey];
  }
  return true;
}

// ── Subscriptions ─────────────────────────────────────────

export async function getActiveSubscriptionsForUsers(
  userIds: string[],
): Promise<PushSubscriptionRow[]> {
  if (userIds.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("push_subscriptions")
    .select("*")
    .in("user_id", userIds)
    .eq("is_active", true);
  return (data ?? []) as PushSubscriptionRow[];
}

export async function deactivateSubscription(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("push_subscriptions").update({ is_active: false }).eq("id", id);
}
