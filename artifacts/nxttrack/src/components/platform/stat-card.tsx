import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  hint?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, hint, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border p-5 shadow-sm",
        className,
      )}
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </span>
        {Icon && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--surface-soft)", color: "var(--text-secondary)" }}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="text-3xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
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
