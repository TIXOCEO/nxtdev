import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Achtergrond-variant voor variatie tussen secties. */
  tone?: "default" | "soft" | "accent" | "dark";
  /** `sm` → minder verticale ruimte (gebruikt voor compacte teasers). */
  size?: "sm" | "md" | "lg";
  containerClassName?: string;
}

const TONE_CLASSES: Record<NonNullable<SectionProps["tone"]>, string> = {
  default: "bg-white",
  soft: "bg-[var(--surface-soft)]",
  accent:
    "bg-gradient-to-br from-[#f7fbe9] via-white to-[#eef6cf] border-y border-[var(--surface-border)]",
  dark: "bg-[#0b0f0a] text-white",
};

const SIZE_CLASSES: Record<NonNullable<SectionProps["size"]>, string> = {
  sm: "py-12 md:py-16",
  md: "py-20 md:py-28",
  lg: "py-24 md:py-36",
};

export function Section({
  children,
  className,
  id,
  tone = "default",
  size = "md",
  containerClassName,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(TONE_CLASSES[tone], SIZE_CLASSES[size], className)}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12",
          containerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

interface EyebrowHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  align?: "left" | "center";
  className?: string;
  /** Heading-niveau. Gebruik `h1` voor de primaire pagina-titel. */
  as?: "h1" | "h2" | "h3";
}

export function EyebrowHeading({
  eyebrow,
  title,
  body,
  align = "left",
  className,
  as: Tag = "h2",
}: EyebrowHeadingProps) {
  return (
    <div
      className={cn(
        align === "center" ? "text-center mx-auto max-w-3xl" : "max-w-3xl",
        className,
      )}
    >
      {eyebrow ? (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] backdrop-blur">
          <span className="size-1.5 rounded-full bg-[var(--accent)]" />
          {eyebrow}
        </div>
      ) : null}
      <Tag className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[var(--text-primary)] [text-wrap:balance]">
        {title}
      </Tag>
      {body ? (
        <p className="mt-5 text-lg leading-relaxed text-[var(--text-secondary)]">
          {body}
        </p>
      ) : null}
    </div>
  );
}
