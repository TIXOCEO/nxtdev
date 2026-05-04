import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconFramePlaceholderProps {
  icon: LucideIcon;
  label?: string;
  /**
   * Verhouding van de placeholder.
   * `wide` → 16/9 (hero, sectiebanner)
   * `square` → 1/1
   * `tall` → 4/5 (portret)
   */
  ratio?: "wide" | "square" | "tall";
  /** Kleurvariant van de gradient. */
  tone?: "lime" | "ivory" | "midnight";
  className?: string;
}

const RATIO_CLASSES: Record<NonNullable<IconFramePlaceholderProps["ratio"]>, string> = {
  wide: "aspect-[16/9]",
  square: "aspect-square",
  tall: "aspect-[4/5]",
};

const TONE_CLASSES: Record<
  NonNullable<IconFramePlaceholderProps["tone"]>,
  { bg: string; iconColor: string; label: string }
> = {
  lime: {
    bg: "bg-gradient-to-br from-[#eaf5b8] via-[#f6fbdf] to-white",
    iconColor: "text-[#3f5a08]",
    label: "text-[#3f5a08]/70",
  },
  ivory: {
    bg: "bg-gradient-to-br from-white via-[var(--surface-soft)] to-[#e8edf6]",
    iconColor: "text-[var(--text-primary)]",
    label: "text-[var(--text-secondary)]",
  },
  midnight: {
    bg: "bg-gradient-to-br from-[#0b0f0a] via-[#1c2616] to-[#3a4d20] text-white",
    iconColor: "text-[var(--accent)]",
    label: "text-white/60",
  },
};

/**
 * Een mooie placeholder-"foto" voor de marketingsite. Gebruikt een
 * gradient-achtergrond met een groot lucide-icoon, totdat er echte foto's
 * beschikbaar zijn.
 */
export function IconFramePlaceholder({
  icon: Icon,
  label,
  ratio = "wide",
  tone = "lime",
  className,
}: IconFramePlaceholderProps) {
  const palette = TONE_CLASSES[tone];
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-3xl border border-[var(--surface-border)] shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)]",
        RATIO_CLASSES[ratio],
        palette.bg,
        className,
      )}
    >
      {/* Decoratieve blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-white/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 size-80 rounded-full bg-[var(--accent)]/30 blur-3xl" />

      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center gap-4 text-center px-8">
          <div className="rounded-2xl bg-white/70 p-5 shadow-sm backdrop-blur-sm">
            <Icon className={cn("size-12 sm:size-14", palette.iconColor)} strokeWidth={1.5} />
          </div>
          {label ? (
            <span
              className={cn(
                "text-xs sm:text-sm font-medium uppercase tracking-widest",
                palette.label,
              )}
            >
              {label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
