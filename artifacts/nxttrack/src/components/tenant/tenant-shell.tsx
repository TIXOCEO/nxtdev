import type { ReactNode } from "react";
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
  /** Slug + (optionele) custom domain — gebruikt voor "terug naar publieke site". */
  tenantSlug?: string;
  tenantDomain?: string | null;
  /** Huidige (laatst gepubliceerde) NXTTRACK-versie, getoond onder "Powered by". */
  currentVersion?: string | null;
  /** True wanneer de huidige gebruiker de laatste release nog niet als gezien heeft gemarkeerd. */
  currentVersionUnseen?: boolean;
  /** Sprint 65 — toon de "Intake"-link in de sidebar (alleen als dynamic intake aanstaat). */
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
  return (
    <div
      className="flex h-dvh w-full"
      style={{
        background:
          "linear-gradient(180deg, var(--bg-viewport-start) 0%, var(--bg-viewport-end) 100%)",
      }}
    >
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
        />
        <main
          className="flex-1 overflow-y-auto px-4 pt-5 sm:px-6 sm:pt-6"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)",
          }}
        >
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
