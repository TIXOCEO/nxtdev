"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Plus,
  Settings,
  ShieldCheck,
  Mail,
  ScrollText,
  ImageIcon,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard",  icon: LayoutDashboard, href: "/platform" },
  { label: "Tenants",    icon: Building2,       href: "/platform/tenants" },
  { label: "New Tenant", icon: Plus,            href: "/platform/tenants/new" },
  { label: "Email",      icon: Mail,            href: "/platform/email" },
  { label: "Email logs", icon: ScrollText,      href: "/platform/email/logs" },
  { label: "Profielafbeeldingen", icon: ImageIcon, href: "/platform/profile-pictures" },
  { label: "Themes",     icon: Palette,         href: "/platform/themes" },
  { label: "Settings",   icon: Settings,        href: "/platform/settings" },
];

export function PlatformSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-full w-full flex-col border-r md:w-[220px] md:shrink-0"
      style={{
        backgroundColor: "var(--bg-nav)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div
        className="flex items-center gap-3 border-b px-5 py-5"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <ShieldCheck className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
        </div>
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            NXTTRACK
          </p>
          <p
            className="truncate text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Platform Admin
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          // Exact-match for /platform and /platform/email so they don't
          // double-highlight when on a more specific route like
          // /platform/email/logs (which has its own nav item).
          const exactMatchOnly =
            item.href === "/platform" || item.href === "/platform/email";
          const isActive = exactMatchOnly
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                isActive ? "shadow-sm" : "hover:bg-black/5",
              )}
              style={
                isActive
                  ? { backgroundColor: "var(--accent)", color: "var(--text-primary)" }
                  : { color: "var(--text-secondary)" }
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        className="border-t px-5 py-4 text-[11px]"
        style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
      >
        Platform-level access. Modules coming later.
      </div>
    </aside>
  );
}
