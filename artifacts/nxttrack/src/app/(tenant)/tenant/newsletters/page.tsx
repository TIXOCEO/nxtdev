import Link from "next/link";
import { Send, ArrowRight, Plus, CheckCircle2, AlertCircle, Loader2, FileEdit } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { listNewslettersByTenant } from "@/lib/db/newsletters";
import type { Newsletter, NewsletterStatus } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TenantNewslettersPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const newsletters = await listNewslettersByTenant(result.tenant.id);

  return (
    <>
      <PageHeading
        title="Nieuwsbrieven"
        description="Stel een nieuwsbrief samen met de rich-text editor en stuur direct naar al je leden of een specifieke groep."
        actions={
          <Link
            href="/tenant/newsletters/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="h-4 w-4" /> Nieuwe nieuwsbrief
          </Link>
        }
      />

      {newsletters.length === 0 ? (
        <EmptyState
          icon={Send}
          title="Nog geen nieuwsbrieven"
          description="Maak je eerste nieuwsbrief aan en verstuur deze naar al je leden of een geselecteerde groep."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {newsletters.map((n) => (
            <li
              key={n.id}
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: "var(--surface-main)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {n.title}
                  </p>
                  {n.preheader && (
                    <p
                      className="mt-0.5 line-clamp-1 text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {n.preheader}
                    </p>
                  )}
                  <p className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    Doelgroep:{" "}
                    {n.audience_type === "all"
                      ? "Alle leden"
                      : `${n.audience_group_ids.length} groep(en)`}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    Bijgewerkt: {new Date(n.updated_at).toLocaleDateString("nl-NL")}
                  </p>
                </div>
                <StatusBadge n={n} />
              </div>

              {n.status === "sent" && (
                <p className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Verstuurd naar {n.sent_count} van {n.recipient_count} ontvangers
                  {n.failed_count > 0 && ` (${n.failed_count} mislukt)`}
                  {n.sent_at && ` · ${new Date(n.sent_at).toLocaleString("nl-NL")}`}
                </p>
              )}
              {n.status === "failed" && n.last_error && (
                <p className="mt-2 text-[11px] text-red-600 line-clamp-2">{n.last_error}</p>
              )}

              <div className="mt-3 flex justify-end">
                <Link
                  href={`/tenant/newsletters/${n.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {n.status === "draft" || n.status === "failed"
                    ? "Bewerken"
                    : "Bekijken"}{" "}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function StatusBadge({ n }: { n: Newsletter }) {
  const conf: Record<
    NewsletterStatus,
    { label: string; bg: string; fg: string; Icon: typeof FileEdit }
  > = {
    draft: { label: "Concept", bg: "#f1f5f9", fg: "#475569", Icon: FileEdit },
    sending: { label: "Wordt verstuurd…", bg: "#fef9c3", fg: "#854d0e", Icon: Loader2 },
    sent: { label: "Verstuurd", bg: "#dcfce7", fg: "#166534", Icon: CheckCircle2 },
    failed: { label: "Mislukt", bg: "#fee2e2", fg: "#991b1b", Icon: AlertCircle },
  };
  const c = conf[n.status as NewsletterStatus] ?? conf.draft;
  const Icon = c.Icon;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <Icon className={`h-3 w-3 ${n.status === "sending" ? "animate-spin" : ""}`} />
      {c.label}
    </span>
  );
}
