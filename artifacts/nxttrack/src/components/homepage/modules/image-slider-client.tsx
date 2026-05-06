"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ImageSliderImage {
  url: string;
  alt?: string;
  link?: string;
}

interface Props {
  images: ImageSliderImage[];
  autoplay?: boolean;
  intervalMs?: number;
}

/**
 * Sprint 29 — Image slider:
 *  • 0 afbeeldingen → niets renderen (de wrapper toont fallback).
 *  • 1 afbeelding   → stilstaand beeld dat de container vult.
 *  • 2+             → autoplay slider met dots/arrows, vaste containerhoogte.
 */
export function ImageSliderClient({ images, autoplay = true, intervalMs = 5000 }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!autoplay || images.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, Math.max(1500, intervalMs));
    return () => window.clearInterval(id);
  }, [autoplay, intervalMs, images.length]);

  if (images.length === 0) return null;

  const current = images[Math.min(index, images.length - 1)];
  const goPrev = () =>
    setIndex((i) => (i - 1 + images.length) % images.length);
  const goNext = () => setIndex((i) => (i + 1) % images.length);

  const inner = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current.url}
      alt={current.alt ?? ""}
      className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
    />
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[var(--radius-nxt-lg)] border"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-soft)",
      }}
    >
      {current.link ? (
        <a
          href={current.link}
          target={current.link.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="absolute inset-0 block"
        >
          {inner}
        </a>
      ) : (
        inner
      )}

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Vorige afbeelding"
            className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-black/40 text-white hover:bg-black/60"
            style={{ borderColor: "rgba(255,255,255,0.4)" }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Volgende afbeelding"
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-black/40 text-white hover:bg-black/60"
            style={{ borderColor: "rgba(255,255,255,0.4)" }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ga naar afbeelding ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 22 : 8,
                  backgroundColor:
                    i === index ? "#ffffff" : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
