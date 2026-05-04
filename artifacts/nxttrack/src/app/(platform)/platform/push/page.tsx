import { Suspense } from "react";
import { PageHeading } from "@/components/ui/page-heading";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { getPlatformPushSettings } from "@/lib/db/push";
import { getNotificationEventsByTenant } from "@/lib/db/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformPushForm } from "./_form";
import type { NotificationEvent } from "@/types/database";

export const dynamic = "force-dynamic";

async function getAllEventKeys(): Promise<string[]> {
  // Pull a tenant id (any) and query its events as a sample list.
  // Event keys are seeded per-tenant from a fixed catalog so any tenant works.
  const admin = createAdminClient();
  const { data: t } = await admin.from("tenants").select("id").limit(1).maybeSingle();
  if (!t) return [];
  const events = await getNotificationEventsByTenant((t as { id: string }).id);
  return Array.from(new Set(events.map((e: NotificationEvent) => e.event_key))).sort();
}

export default async function PlatformPushPage() {
  await requirePlatformAdmin();
  const [settings, eventKeys] = await Promise.all([
    getPlatformPushSettings(),
    getAllEventKeys(),
  ]);

  return (
    <>
      <PageHeading
        title="Push notifications"
        description="Configure VAPID keys, sender subject, and which event types may fan out to web push."
      />
      <Suspense fallback={null}>
        <PlatformPushForm
          initial={{
            vapid_public_key: settings?.vapid_public_key ?? null,
            vapid_subject: settings?.vapid_subject ?? "mailto:admin@nxttrack.nl",
            allowed_event_keys: settings?.allowed_event_keys ?? [],
          }}
          eventKeys={eventKeys}
        />
      </Suspense>
    </>
  );
}
