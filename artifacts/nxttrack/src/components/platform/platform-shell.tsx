import type { ReactNode } from "react";
import { PlatformSidebar } from "./platform-sidebar";
import { PlatformHeader } from "./platform-header";

export interface PlatformShellProps {
  children: ReactNode;
  email?: string | null;
}

export function PlatformShell({ children, email }: PlatformShellProps) {
  return (
    <div
      className="flex h-dvh w-full"
      style={{
        background:
          "linear-gradient(180deg, var(--bg-viewport-start) 0%, var(--bg-viewport-end) 100%)",
      }}
    >
      <div className="hidden md:flex">
        <PlatformSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <PlatformHeader email={email} />
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
