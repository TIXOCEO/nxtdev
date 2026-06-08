import Link from "next/link";
import { ExternalLink, Search, ShieldCheck, Zap } from "lucide-react";
import { MobileNavTrigger } from "@/components/admin/mobile-nav-trigger";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { TenantSidebar } from "./tenant-sidebar";
import { TenantProfileMenu } from "./tenant-profile-menu";
import { buildPublicTenantUrl } from "@/lib/tenant/public-url";

export interface TenantHeaderProps {
  tenantName: string;
  primaryColor?: string | null;
  email?: string | null;
  isPlatformAdmin?: boolean;
  queryString?: string;
  tenantSlug?: string;
  tenantDomain?: string | null;
  currentVersion?: string | null;
  currentVersionUnseen?: boolean;
  showIntake?: boolean;
}

export function TenantHeader({
  tenantName,
  primaryColor,
  email,
  isPlatformAdmin,
  queryString = "",
  tenantSlug,
  tenantDomain,
  currentVersion,
  currentVersionUnseen,
  showIntake,
}: TenantHeaderProps) {
  const publicUrl = buildPublicTenantUrl(tenantSlug, tenantDomain);
  return (
    <header
      className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 lg:px-8"
      style={{
        borderColor: "var(--shell-border)",
        backgroundColor: "color-mix(in srgb, var(--shell-panel-strong) 86%, transparent)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <MobileNavTrigger label="Open tenant menu">
          <TenantSidebar
            tenantName={tenantName}
            primaryColor={primaryColor}
            queryString={queryString}
            currentVersion={currentVersion}
            currentVersionUnseen={currentVersionUnseen}
            showIntake={showIntake}
          />
        </MobileNavTrigger>
        <div className="min-w-0">
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.14em] sm:block" style={{ color: "var(--text-secondary)" }}>
            Tenant backoffice
          </p>
          <h1
            className="truncate text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {tenantName}
          </h1>
        </div>
        {isPlatformAdmin && (
          <Link
            href="/platform"
            className="hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:inline-flex"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            title="You are viewing this tenant as platform admin"
          >
            <ShieldCheck className="h-3 w-3" />
            Platform
          </Link>
        )}
      </div>

      <div className="hidden min-w-[260px] max-w-md flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm lg:flex" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)", color: "var(--text-secondary)" }}>
        <Search className="h-4 w-4" />
        <span>Zoek leden, groepen, lessen...</span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/tenant/taken"
          className="nxt-focus-ring nxt-shell-primary-button hidden items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold sm:inline-flex"
        >
          <Zap className="h-3.5 w-3.5" />
          Snelle actie
        </Link>
        {publicUrl ? (
          <Link
            href={publicUrl}
            target="_blank"
            className="nxt-focus-ring hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold sm:inline-flex"
            style={{
              borderColor: "var(--shell-border)",
              color: "var(--text-secondary)",
              backgroundColor: "var(--shell-panel-bg)",
            }}
          >
            Publieke site
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
        <NotificationCenter />
        <TenantProfileMenu email={email ?? null} publicUrl={publicUrl} />
      </div>
    </header>
  );
}
