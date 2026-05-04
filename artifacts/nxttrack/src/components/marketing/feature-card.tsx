import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  body: string;
  href?: string;
  className?: string;
  /** `solid` voor benadrukte cards op een gekleurde achtergrond. */
  variant?: "default" | "solid" | "outline";
}

const VARIANT_CLASSES: Record<NonNullable<FeatureCardProps["variant"]>, string> = {
  default:
    "bg-white border border-[var(--surface-border)] hover:border-[var(--accent)] hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]",
  solid:
    "bg-gradient-to-br from-[#0b0f0a] to-[#1c2616] text-white border border-white/10 hover:border-[var(--accent)]",
  outline:
    "bg-transparent border border-[var(--surface-border)] hover:border-[var(--accent)]",
};

export function FeatureCard({
  icon: Icon,
  title,
  body,
  href,
  className,
  variant = "default",
}: FeatureCardProps) {
  const inner = (
    <div
      className={cn(
        "group relative h-full rounded-3xl p-6 sm:p-7 transition-all duration-300",
        VARIANT_CLASSES[variant],
        href ? "cursor-pointer" : "",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex size-12 items-center justify-center rounded-2xl",
          variant === "solid"
            ? "bg-[var(--accent)]/15 text-[var(--accent)]"
            : "bg-[var(--surface-soft)] text-[var(--text-primary)] group-hover:bg-[var(--accent)]/15 group-hover:text-[#3f5a08] transition-colors",
        )}
      >
        <Icon className="size-6" strokeWidth={1.75} />
      </div>
      <h3
        className={cn(
          "mt-5 text-lg sm:text-xl font-semibold tracking-tight",
          variant === "solid" ? "text-white" : "text-[var(--text-primary)]",
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "mt-2.5 text-sm sm:text-base leading-relaxed",
          variant === "solid" ? "text-white/70" : "text-[var(--text-secondary)]",
        )}
      >
        {body}
      </p>
      {href ? (
        <span
          className={cn(
            "mt-5 inline-flex items-center gap-1 text-sm font-medium",
            variant === "solid"
              ? "text-[var(--accent)]"
              : "text-[#3f5a08] group-hover:gap-2 transition-all",
          )}
        >
          Meer over deze module
          <ArrowUpRight className="size-4" />
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}
