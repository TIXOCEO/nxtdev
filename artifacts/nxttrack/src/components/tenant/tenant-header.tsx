import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { MobileNavTrigger } from "@/components/admin/mobile-nav-trigger";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { TenantSidebar } from "./tenant-sidebar";

export interface TenantHeaderProps {
  tenantName: string;
  primaryColor?: string | null;
  email?: string | null;
  isPlatformAdmin?: boolean;
  queryString?: string;
}

export function TenantHeader({
  tenantName,
  primaryColor,
  email,
  isPlatformAdmin,
  queryString = "",
}: TenantHeaderProps) {
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
