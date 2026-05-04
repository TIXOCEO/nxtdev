import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getMembersByTenant } from "@/lib/db/members";
import { getGroupsByTenant } from "@/lib/db/groups";
import { NotificationForm } from "../_notification-form";

export const dynamic = "force-dynamic";

export default async function NewNotificationPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [members, groups] = await Promise.all([
    getMembersByTenant(result.tenant.id),
    getGroupsByTenant(result.tenant.id),
  ]);

  return (
    <>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Link
          href="/tenant/notifications"
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar meldingen
        </Link>
      </div>
      <PageHeading
        title="Nieuwe melding"
        description="Stel een titel en bericht op en kies wie het ontvangt."
      />
      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <NotificationForm
          tenantId={result.tenant.id}
          members={members.map((m) => ({ id: m.id, full_name: m.full_name }))}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        />
      </div>
    </>
  );
}
