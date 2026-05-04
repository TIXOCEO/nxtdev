"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface HeroSlide {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface PublicHeroSliderProps {
  tenantName: string;
  slides?: HeroSlide[];
  /** Auto-advance interval in ms. Set 0 to disable. Default 6000. */
  intervalMs?: number;
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
  const goPrev = () => setIndex((i) => (i - 1 + finalSlides.length) % finalSlides.length);
  const goNext = () => setIndex((i) => (i + 1) % finalSlides.length);

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-nxt-lg)] border"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
        boxShadow: "var(--shadow-app)",
        backgroundImage:
          "linear-gradient(135deg, color-mix(in srgb, var(--tenant-accent) 22%, var(--surface-main)) 0%, var(--surface-main) 60%)",
      }}
    >
      <div className="relative flex min-h-[220px] flex-col justify-between gap-6 p-6 sm:min-h-[260px] sm:p-8">
        <div className="space-y-3">
          <p
            className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: "color-mix(in srgb, var(--tenant-accent) 25%, transparent)",
              color: "var(--text-primary)",
            }}
          >
            {slide.eyebrow}
          </p>
          <h1
            className="text-2xl font-bold leading-tight sm:text-3xl"
            style={{ color: "var(--text-primary)" }}
          >
            {slide.title}
          </h1>
          <p className="max-w-xl text-sm sm:text-base" style={{ color: "var(--text-secondary)" }}>
            {slide.body}
          </p>
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
                  backgroundColor:
                    i === index ? "var(--tenant-accent)" : "var(--surface-border)",
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slide"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-black/5"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-black/5"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
