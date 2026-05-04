import { ShieldCheck } from "lucide-react";
import { MobileNavTrigger } from "@/components/admin/mobile-nav-trigger";
import { PlatformSidebar } from "./platform-sidebar";

export interface PlatformHeaderProps {
  email?: string | null;
}

export function PlatformHeader({ email }: PlatformHeaderProps) {
  return (
    <header
      className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--bg-app)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <MobileNavTrigger label="Open platform menu">
          <PlatformSidebar />
        </MobileNavTrigger>
        <h1
          className="truncate text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Platform
        </h1>
        <span
          className="hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:inline-flex"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <ShieldCheck className="h-3 w-3" />
          Admin
        </span>
      </div>

      {email && (
        <div
          className="hidden truncate text-xs sm:block"
          style={{ color: "var(--text-secondary)" }}
        >
          {email}
        </div>
      )}
    </header>
  );
}
