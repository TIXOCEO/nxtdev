"use client";

import { Bell, User } from "lucide-react";
import { useTenant } from "@/context/tenant-context";

const planColors: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  starter: "bg-blue-50 text-blue-700",
  pro: "bg-purple-50 text-purple-700",
  enterprise: "bg-amber-50 text-amber-700",
};

export function Header() {
  const { tenant } = useTenant();

  return (
    <header
      className="flex items-center justify-between px-6 py-3 border-b shrink-0"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--bg-app)",
      }}
    >
      {/* Left: tenant name + plan badge */}
      <div className="flex items-center gap-3">
        <h1
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {tenant?.name ?? ""}
        </h1>
        {tenant?.plan && (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${planColors[tenant.plan] ?? planColors.free}`}
          >
            {tenant.plan}
          </span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        <button
          type="button"
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--text-primary)",
          }}
          aria-label="User menu"
        >
          <User className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
