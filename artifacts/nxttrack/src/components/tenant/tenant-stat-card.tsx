import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TenantStatCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  hint?: string;
  className?: string;
}

export function TenantStatCard({ label, value, icon: Icon, hint, className }: TenantStatCardProps) {
  return (
    <div
      className={cn(
        "nxt-shell-hover flex flex-col gap-2 rounded-[20px] border p-4 shadow-sm sm:p-5",
        className,
      )}
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-strong) 84%, transparent), var(--shell-panel-bg))",
        borderColor: "var(--shell-border)",
        boxShadow: "var(--shell-shadow-card)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-bold uppercase tracking-[0.12em]"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </span>
        {Icon && (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl border"
            style={{
              borderColor: "var(--shell-border)",
              backgroundColor:
                "color-mix(in srgb, var(--tenant-accent, var(--accent)) 12%, var(--shell-panel-muted))",
              color: "var(--shell-info)",
            }}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="text-2xl font-black tabular-nums sm:text-3xl" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
      {hint && (
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}
