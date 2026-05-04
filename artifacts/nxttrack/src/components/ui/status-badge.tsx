import { cn } from "@/lib/utils";

export type StatusKind = "active" | "inactive" | "draft" | "published" | "archived" | "new";

const STYLES: Record<StatusKind, { bg: string; text: string; dot: string }> = {
  active:    { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500" },
  inactive:  { bg: "bg-zinc-100",    text: "text-zinc-600",    dot: "bg-zinc-400" },
  draft:     { bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500" },
  published: { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500" },
  archived:  { bg: "bg-zinc-100",    text: "text-zinc-600",    dot: "bg-zinc-400" },
  new:       { bg: "bg-sky-50",      text: "text-sky-700",     dot: "bg-sky-500" },
};

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = (STYLES[status as StatusKind] ? status : "inactive") as StatusKind;
  const styles = STYLES[key];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        styles.bg,
        styles.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
      {status}
    </span>
  );
}
