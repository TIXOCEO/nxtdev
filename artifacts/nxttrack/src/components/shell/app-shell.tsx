import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TenantProvider } from "@/context/tenant-context";

interface AppShellProps {
  children: ReactNode;
  slug: string;
}

export function AppShell({ children, slug }: AppShellProps) {
  return (
    <TenantProvider slug={slug}>
      {/* Full-viewport outer container with gradient background */}
      <div
        className="fixed inset-0 p-[1%]"
        style={{
          background:
            "linear-gradient(135deg, var(--bg-viewport-start), var(--bg-viewport-end))",
        }}
      >
        {/* App card — rounded, shadow, white */}
        <div
          className="flex h-full w-full overflow-hidden"
          style={{
            backgroundColor: "var(--bg-app)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "0 8px 40px var(--shadow-color)",
          }}
        >
          <Sidebar />

          {/* Right panel: header + content */}
          <div className="flex flex-col flex-1 min-w-0">
            <Header />
            <main
              className="flex-1 overflow-y-auto"
              style={{ backgroundColor: "var(--surface-soft)" }}
            >
              {children}
            </main>
          </div>
        </div>
      </div>
    </TenantProvider>
  );
}
