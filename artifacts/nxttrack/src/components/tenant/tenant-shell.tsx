import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import { TenantSidebar } from "./tenant-sidebar";
import { TenantHeader } from "./tenant-header";

export interface TenantShellProps {
  children: ReactNode;
  tenantName: string;
  primaryColor?: string | null;
  email?: string | null;
  isPlatformAdmin?: boolean;
  /** Persisted across nav links, e.g. `?tenant=<id>` for platform admins. */
  queryString?: string;
  /** Slug + optional custom domain, used for "terug naar publieke site". */
  tenantSlug?: string;
  tenantDomain?: string | null;
  /** Huidige (laatst gepubliceerde) NXTTRACK-versie, getoond onder "Powered by". */
  currentVersion?: string | null;
  /** True wanneer de huidige gebruiker de laatste release nog niet als gezien heeft gemarkeerd. */
  currentVersionUnseen?: boolean;
  /** Show the intake link in the sidebar when dynamic intake is enabled. */
  showIntake?: boolean;
}

export function TenantShell({
  children,
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
}: TenantShellProps) {
  const accent = primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor)
    ? primaryColor
    : "var(--accent)";

  return (
    <div
      className="flex h-dvh w-full p-0 md:p-3"
      style={{
        "--tenant-accent": accent,
        background:
          "radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--tenant-accent) 12%, transparent), transparent 32%), linear-gradient(180deg, var(--bg-viewport-start) 0%, var(--bg-viewport-end) 100%)",
      } as CSSProperties}
    >
      <div className="flex min-h-0 w-full overflow-hidden border bg-[var(--shell-frame-bg)] shadow-app md:rounded-[22px]" style={{ borderColor: "var(--shell-border)" }}>
        <div className="hidden md:flex">
          <TenantSidebar
            tenantName={tenantName}
            primaryColor={primaryColor}
            queryString={queryString}
            currentVersion={currentVersion}
            currentVersionUnseen={currentVersionUnseen}
            showIntake={showIntake}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <TenantHeader
            tenantName={tenantName}
            primaryColor={primaryColor}
            email={email}
            isPlatformAdmin={isPlatformAdmin}
            queryString={queryString}
            tenantSlug={tenantSlug}
            tenantDomain={tenantDomain}
            currentVersion={currentVersion}
            currentVersionUnseen={currentVersionUnseen}
            showIntake={showIntake}
          />
          <main
            className="nxt-scrollbar flex-1 overflow-y-auto px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8"
            style={{
              background: "linear-gradient(180deg, var(--shell-page-bg), var(--page-bg, var(--shell-page-bg)))",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)",
            }}
          >
            <div className="mx-auto w-full max-w-7xl space-y-5">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
