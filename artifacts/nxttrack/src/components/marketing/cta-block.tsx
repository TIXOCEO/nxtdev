import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface CtaBlockProps {
  eyebrow?: string;
  title: string;
  body?: string;
  className?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

/**
 * Centrale call-to-action die op meerdere pagina's terugkomt.
 * Donkere achtergrond met groen accent — past bij het merk.
 */
export function CtaBlock({
  eyebrow = "Klaar voor de volgende stap?",
  title,
  body,
  className,
  primaryHref = "/contact",
  primaryLabel = "Plan kennismakingsgesprek",
  secondaryHref = "/features",
  secondaryLabel = "Bekijk de features",
}: CtaBlockProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[36px] bg-gradient-to-br from-[#0b0f0a] via-[#1c2616] to-[#2a3a18] p-10 sm:p-14 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.5)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-16 -right-16 size-72 rounded-full bg-[var(--accent)]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-72 rounded-full bg-[var(--accent)]/10 blur-3xl" />

      <div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          {eyebrow ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/70">
              <span className="size-1.5 rounded-full bg-[var(--accent)]" />
              {eyebrow}
            </div>
          ) : null}
          <h3 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight [text-wrap:balance]">
            {title}
          </h3>
          {body ? (
            <p className="mt-4 text-base sm:text-lg leading-relaxed text-white/75 max-w-2xl">
              {body}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-stretch">
          <Button
            asChild
            size="lg"
            className="bg-[var(--accent)] text-[#1c2616] hover:bg-[#a7cb24] rounded-2xl shadow-lg shadow-[var(--accent)]/30 h-12 text-[15px] font-semibold"
          >
            <Link href={primaryHref}>
              <Calendar className="size-4" />
              {primaryLabel}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white rounded-2xl h-12 text-[15px] font-semibold"
          >
            <Link href={secondaryHref}>
              {secondaryLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
