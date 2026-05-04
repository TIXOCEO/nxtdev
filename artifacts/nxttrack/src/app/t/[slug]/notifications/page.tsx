import { notFound, redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getUser } from "@/lib/auth/get-user";
import { getMyNotifications } from "@/lib/db/notifications";
import { getPlatformPushPublic } from "@/lib/db/push";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { PushPermissionCard } from "@/components/pwa/push-permission-card";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import { MarkReadButton } from "./_mark-read";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PublicNotificationsPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();
  const user = await getUser();
  if (!user) redirect(`/t/${slug}/login?next=/t/${slug}/notifications`);

  const [items, platform] = await Promise.all([
    getMyNotifications(50),
    getPlatformPushPublic(),
  ]);
  const tenantItems = items.filter((i) => i.notification.tenant_id === tenant.id);

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Meldingen" active="notifications">
      <div className="space-y-3">
        <InstallAppPrompt tenantName={tenant.name} />
        <PushPermissionCard
          tenantId={tenant.id}
          vapidPublicKey={platform?.vapid_public_key ?? null}
        />

        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Mijn meldingen
          </h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Alle berichten die {tenant.name} aan jou verstuurt.
          </p>
        </div>

        {tenantItems.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nog geen meldingen"
            description="Zodra de club iets stuurt, verschijnt dat hier."
          />
        ) : (
          <ul className="grid gap-2">
            {tenantItems.map((row) => (
              <li
                key={row.recipient_id}
                className="rounded-2xl border p-3"
                style={{
                  backgroundColor: "var(--surface-main)",
                  borderColor: "var(--surface-border)",
                  borderLeftWidth: row.is_read ? 1 : 4,
                  borderLeftColor: row.is_read
                    ? "var(--surface-border)"
                    : "var(--tenant-accent)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {row.notification.title}
                    </p>
                    <p
                      className="mt-0.5 text-[11px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {fmt(row.created_at)}
                    </p>
                    {row.notification.content_html && (
                      <div
                        className="prose prose-sm mt-2 max-w-none text-sm"
                        style={{ color: "var(--text-secondary)" }}
                        dangerouslySetInnerHTML={{
                          __html: row.notification.content_html,
                        }}
                      />
                    )}
                  </div>
                  {!row.is_read && (
                    <MarkReadButton recipientId={row.recipient_id} slug={slug} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PublicTenantShell>
  );
}
