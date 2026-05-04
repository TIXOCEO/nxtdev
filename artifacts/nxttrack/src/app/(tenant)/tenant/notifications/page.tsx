import Link from "next/link";
import { Plus, Bell, Mail } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getNotificationsByTenant } from "@/lib/db/notifications";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NotificationsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const items = await getNotificationsByTenant(result.tenant.id);

  return (
    <>
      <PageHeading
        title="Meldingen"
        description="Verstuur berichten naar leden, groepen of rollen."
        actions={
          <Link
            href="/tenant/notifications/new"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium shadow-xs"
            style={{
              backgroundColor: "var(--accent)",
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          >
            <Plus className="h-4 w-4" /> Nieuwe melding
          </Link>
        }
      />

      <div
        className="rounded-2xl border"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        {items.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
            style={{ color: "var(--text-secondary)" }}
          >
            <Bell className="h-8 w-8" />
            <p className="text-sm">Nog geen meldingen verstuurd.</p>
            <Link
              href="/tenant/notifications/new"
              className="mt-2 text-sm font-medium underline"
              style={{ color: "var(--text-primary)" }}
            >
              Verstuur je eerste melding
            </Link>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
            {items.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {formatDate(n.created_at)}
                    {n.source && n.source !== "manual" && (
                      <span
                        className="ml-2 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{ borderColor: "var(--surface-border)" }}
                      >
                        {n.source.replace(/_/g, " ")}
                      </span>
                    )}
                  </p>
                </div>
                <div
                  className="flex shrink-0 items-center gap-3 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span title="Ontvangers">
                    {n.recipient_count} ontvangers · {n.read_count} gelezen
                  </span>
                  {n.email_sent && (
                    <span className="inline-flex items-center gap-1" title="E-mail verstuurd">
                      <Mail className="h-3.5 w-3.5" /> e-mail
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
