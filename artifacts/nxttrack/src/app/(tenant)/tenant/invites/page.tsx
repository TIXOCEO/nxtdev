import { MailPlus } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getInvitesByTenant } from "@/lib/db/invites";
import {
  INVITE_STATUS_LABELS,
  INVITE_TYPE_LABELS,
  type InviteStatusLiteral,
  type InviteTypeLiteral,
} from "@/lib/actions/tenant/invite-statuses";
import { InviteRowActions } from "./_invite-actions";
import { tenantUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  pending: "#9ca3af",
  sent: "#3b82f6",
  opened: "#8b5cf6",
  accepted: "#10b981",
  expired: "#f59e0b",
  revoked: "#ef4444",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function TenantInvitesPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const invites = await getInvitesByTenant(result.tenant.id);
  const tenantHost = {
    slug: result.tenant.slug,
    domain: (result.tenant as { domain?: string | null }).domain ?? null,
  };

  return (
    <>
      <PageHeading
        title="Uitnodigingen"
        description="Overzicht van verstuurde uitnodigingen voor leden, ouders en trainers."
      />

      {invites.length === 0 ? (
        <EmptyState
          icon={MailPlus}
          title="Nog geen uitnodigingen verstuurd"
          description="Maak een lid aan via Leden en kies 'Uitnodigen via e-mail' om te starten."
        />
      ) : (
        <ul className="space-y-3">
          {invites.map((inv) => {
            const acceptUrl = tenantUrl(tenantHost, `/invite/${inv.token}`);
            const expired = new Date(inv.expires_at).getTime() < Date.now();
            const displayStatus = expired && inv.status !== "accepted" && inv.status !== "revoked"
              ? "expired"
              : inv.status;
            return (
              <li
                key={inv.id}
                className="rounded-2xl border p-4 sm:p-5"
                style={{
                  backgroundColor: "var(--surface-main)",
                  borderColor: "var(--surface-border)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${STATUS_COLORS[displayStatus] ?? "#888"} 20%, transparent)`,
                          color: "var(--text-primary)",
                        }}
                      >
                        {INVITE_STATUS_LABELS[displayStatus as InviteStatusLiteral] ??
                          displayStatus}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
                        style={{
                          borderColor: "var(--surface-border)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {INVITE_TYPE_LABELS[inv.invite_type as InviteTypeLiteral] ??
                          inv.invite_type}
                      </span>
                    </div>
                    <p
                      className="mt-1.5 text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {inv.full_name ?? inv.email}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {inv.email}
                      {inv.member_name && (
                        <>
                          {" · Lid: "}
                          {inv.member_name}
                        </>
                      )}
                      {inv.child_name && (
                        <>
                          {" · Kind: "}
                          {inv.child_name}
                        </>
                      )}
                    </p>
                    <p
                      className="mt-1 font-mono text-[11px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Code: {inv.invite_code}
                    </p>
                    <p
                      className="mt-1 text-[11px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Aangemaakt {fmt(inv.created_at)} · Verloopt {fmt(inv.expires_at)} ·
                      Verzonden {inv.resend_count + (inv.last_sent_at ? 1 : 0)}×
                    </p>
                  </div>
                  <InviteRowActions
                    tenantId={result.tenant.id}
                    inviteId={inv.id}
                    status={displayStatus}
                    inviteCode={inv.invite_code}
                    acceptUrl={acceptUrl}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
