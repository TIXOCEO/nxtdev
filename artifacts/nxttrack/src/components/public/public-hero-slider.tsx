"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface HeroSlide {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Optional background image URL — when set, slide gets dark overlay + light text. */
  backgroundImageUrl?: string;
}

export interface PublicHeroSliderProps {
  tenantName: string;
  slides?: HeroSlide[];
  /** Auto-advance interval in ms. Set 0 to disable. Default 6000. */
  intervalMs?: number;
}

/**
 * Beperk CTA hrefs tot veilige protocollen / paden, om ingevoerde
 * `javascript:` of `data:` URLs te blokkeren.
 */
function safeHref(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("/")) return v;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("mailto:") || v.startsWith("tel:")) return v;
  // Tenant-relatieve slug zoals "nieuws" of "info/contact" → maak relatief.
  if (/^[a-z0-9][a-z0-9/_-]*$/i.test(v)) return `/${v}`;
  return null;
}

const DEFAULT_SLIDES = (tenantName: string): HeroSlide[] => [
  {
    eyebrow: "Welkom",
    title: `Welkom bij ${tenantName}`,
    body: "Blijf op de hoogte van het laatste nieuws, evenementen en teamupdates.",
  },
  {
    eyebrow: "Nieuws",
    title: "Lees wat er speelt",
    body: "Toernooien, trainingsupdates en verhalen van achter de schermen.",
    ctaLabel: "Bekijk nieuws",
    ctaHref: "nieuws",
  },
  {
    eyebrow: "Doe mee",
    title: "Schrijf je in voor een proefles",
    body: "Probeer een training en laat de academie je verder helpen.",
    ctaLabel: "Proefles aanvragen",
    ctaHref: "proefles",
  },
];

export function PublicHeroSlider({
  tenantName,
  slides,
  intervalMs = 6000,
}: PublicHeroSliderProps) {
  const finalSlides = slides && slides.length > 0 ? slides : DEFAULT_SLIDES(tenantName);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!intervalMs || finalSlides.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % finalSlides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, finalSlides.length]);

  const slide = finalSlides[index];
  const hasImage = !!slide.backgroundImageUrl;
  const goPrev = () => setIndex((i) => (i - 1 + finalSlides.length) % finalSlides.length);
  const goNext = () => setIndex((i) => (i + 1) % finalSlides.length);

  // Lichte tekstkleur boven foto, anders normale tenant-kleuren.
  const titleColor = hasImage ? "#ffffff" : "var(--text-primary)";
  const bodyColor = hasImage ? "rgba(255,255,255,0.92)" : "var(--text-secondary)";
  const eyebrowBg = hasImage
    ? "rgba(0,0,0,0.45)"
    : "color-mix(in srgb, var(--tenant-accent) 25%, transparent)";
  const eyebrowColor = hasImage ? "#ffffff" : "var(--text-primary)";
  const navBtnBorder = hasImage ? "rgba(255,255,255,0.4)" : "var(--surface-border)";
  const navBtnColor = hasImage ? "#ffffff" : "var(--text-secondary)";
  const dotInactive = hasImage ? "rgba(255,255,255,0.4)" : "var(--surface-border)";
  const dotActive = hasImage ? "#ffffff" : "var(--tenant-accent)";

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-nxt-lg)] border"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
        boxShadow: "var(--shadow-app)",
        backgroundImage: hasImage
          ? `url(${slide.backgroundImageUrl})`
          : "linear-gradient(135deg, color-mix(in srgb, var(--tenant-accent) 22%, var(--surface-main)) 0%, var(--surface-main) 60%)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        transition: "background-image 400ms ease",
      }}
    >
      {/* Donkere overlay alleen bij foto, voor leesbaarheid. */}
      {hasImage && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0.65) 100%)",
          }}
        />
      )}

      <div className="relative flex min-h-[220px] flex-col justify-between gap-4 p-6 sm:min-h-[260px] sm:p-8">
        <div className="space-y-3">
          {slide.eyebrow && (
            <p
              className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: eyebrowBg, color: eyebrowColor }}
            >
              {slide.eyebrow}
            </p>
          )}
          <h1
            className="line-clamp-2 text-2xl font-bold leading-tight sm:text-3xl"
            style={{ color: titleColor, textShadow: hasImage ? "0 1px 2px rgba(0,0,0,0.4)" : undefined }}
          >
            {slide.title}
          </h1>
          {slide.body && (
            <p
              className="line-clamp-3 max-w-xl text-sm sm:text-base"
              style={{ color: bodyColor, textShadow: hasImage ? "0 1px 2px rgba(0,0,0,0.4)" : undefined }}
            >
              {slide.body}
            </p>
          )}
          {slide.ctaLabel && slide.ctaHref && safeHref(slide.ctaHref) && (
            <a
              href={safeHref(slide.ctaHref) ?? "#"}
              className="mt-2 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold sm:text-sm"
              style={{
                backgroundColor: hasImage ? "#ffffff" : "var(--tenant-accent)",
                color: hasImage ? "#111111" : "var(--text-primary)",
              }}
            >
              {slide.ctaLabel}
            </a>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {finalSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 22 : 8,
                  backgroundColor: i === index ? dotActive : dotInactive,
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slide"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-black/10"
              style={{ borderColor: navBtnBorder, color: navBtnColor }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-black/10"
              style={{ borderColor: navBtnBorder, color: navBtnColor }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
