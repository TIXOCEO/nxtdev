import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantEventById } from "@/lib/db/tenant-events";
import { deleteTenantEvent } from "@/lib/actions/tenant/tenant-events";
import { EventForm } from "../_event-form";

export const dynamic = "force-dynamic";

export default async function EditTenantEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;
  const tenantId = result.tenant.id;

  const event = await getTenantEventById(id, tenantId);
  if (!event) notFound();

  async function handleDelete() {
    "use server";
    await deleteTenantEvent(id, tenantId);
  }

  return (
    <>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Link href="/tenant/events" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar events
        </Link>
      </div>
      <PageHeading
        title={event.title}
        description={event.is_featured ? "Uitgelicht event" : "Event"}
        actions={<StatusBadge status={event.status} />}
      />
      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{ backgroundColor: "var(--shell-panel-strong)", borderColor: "var(--shell-border)" }}
      >
        <EventForm
          mode="edit"
          tenantId={tenantId}
          initial={event}
          onDelete={handleDelete}
        />
      </div>
    </>
  );
}
