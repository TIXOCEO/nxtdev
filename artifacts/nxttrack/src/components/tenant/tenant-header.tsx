import Link from "next/link";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { MobileNavTrigger } from "@/components/admin/mobile-nav-trigger";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { TenantSidebar } from "./tenant-sidebar";

export interface TenantHeaderProps {
  tenantName: string;
  primaryColor?: string | null;
  email?: string | null;
  isPlatformAdmin?: boolean;
  queryString?: string;
  tenantSlug?: string;
  tenantDomain?: string | null;
}

/**
 * Bouw de publieke URL voor een tenant. Custom-domein heeft voorrang;
 * anders subdomein onder APEX_DOMAIN. In dev (geen apex bekend) val
 * terug op het relatieve `/t/<slug>` pad zodat de knop niet stuk gaat.
 */
function buildPublicTenantUrl(slug?: string, domain?: string | null): string | null {
  if (!slug) return null;
  if (domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return `https://${domain}`;
  }
  const apex = (
    process.env.NEXT_PUBLIC_APEX_DOMAIN ?? process.env.APEX_DOMAIN ?? ""
  ).trim();
  if (apex) return `https://${slug}.${apex}`;
  return `/t/${slug}`;
}

export function TenantHeader({
  tenantName,
  primaryColor,
  email,
  isPlatformAdmin,
  queryString = "",
  tenantSlug,
  tenantDomain,
}: TenantHeaderProps) {
  const publicUrl = buildPublicTenantUrl(tenantSlug, tenantDomain);
  return (
    <header
      className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--bg-app)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <MobileNavTrigger label="Open tenant menu">
          <TenantSidebar
            tenantName={tenantName}
            primaryColor={primaryColor}
            queryString={queryString}
          />
        </MobileNavTrigger>
        <h1
          className="truncate text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {tenantName}
        </h1>
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

      <div className="flex items-center gap-2">
        {publicUrl && (
          <Link
            href={publicUrl}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={{
              backgroundColor: "var(--surface-soft)",
              color: "var(--text-primary)",
              border: "1px solid var(--surface-border)",
            }}
            title="Terug naar publieke site"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">Publieke site</span>
          </Link>
        )}
        {email && (
          <div
            className="hidden truncate text-xs sm:block"
            style={{ color: "var(--text-secondary)" }}
          >
            {email}
          </div>
        )}
        <NotificationCenter />
      </div>
    </header>
  );
}
