"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/context/tenant-context";

const navItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: (slug: string) => `/t/${slug}/dashboard`,
  },
  {
    label: "Users",
    icon: Users,
    href: (slug: string) => `/t/${slug}/users`,
  },
  {
    label: "Settings",
    icon: Settings,
    href: (slug: string) => `/t/${slug}/settings`,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { slug, tenant } = useTenant();

  return (
    <aside
      className="flex flex-col h-full w-[220px] shrink-0 border-r"
      style={{
        backgroundColor: "var(--bg-nav)",
        borderColor: "var(--surface-border)",
      }}
    >
      {/* Logo + tenant name */}
      <div
        className="flex items-center gap-3 px-5 py-5 border-b"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <Zap className="w-4 h-4" style={{ color: "var(--text-primary)" }} />
        </div>
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            NXTTRACK
          </p>
          <p
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {tenant?.name ?? slug}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const href = item.href(slug);
          const isActive = pathname.startsWith(href);

          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150",
                isActive ? "shadow-sm" : "hover:bg-black/5"
              )}
              style={
                isActive
                  ? {
                      backgroundColor: "var(--accent)",
                      color: "var(--text-primary)",
                    }
                  : { color: "var(--text-secondary)" }
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div
        className="px-5 py-4 border-t"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            AC
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              Alex Carter
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Owner
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
