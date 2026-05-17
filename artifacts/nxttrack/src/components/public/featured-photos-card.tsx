"use client";

import { useState, useCallback, useEffect, useRef, useId } from "react";
import { ImageIcon, X, ChevronLeft, ChevronRight } from "lucide-react";

export interface FeaturedPhoto {
  id: string;
  media_url: string;
  title: string | null;
}

export interface FeaturedPhotosCardProps {
  /** Top-N geactiveerde media-wall items. */
  photos: FeaturedPhoto[];
  /** Items per pagina in het grid (default 4 = 2x2). */
  pageSize?: number;
}

/**
 * Sprint 78b — Uitgelichte foto's kaart met 2x2 grid, paginatie en lightbox.
 * Voedt zich met `media_wall_items` (Sprint 18). Klik op een foto opent een
 * full-screen overlay met prev/next.
 */
export function FeaturedPhotosCard({
  photos,
  pageSize = 4,
}: FeaturedPhotosCardProps) {
  const [page, setPage] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const dialogTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(photos.length / pageSize));
  const start = page * pageSize;
  const visible = photos.slice(start, start + pageSize);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  // Focus management: remember the trigger, focus close button on open,
  // and restore focus on close.
  const openLightbox = useCallback((index: number) => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    setLightboxIndex(index);
  }, []);
  const prevPhoto = useCallback(() => {
    setLightboxIndex((i) =>
      i === null ? null : (i - 1 + photos.length) % photos.length,
    );
  }, [photos.length]);
  const nextPhoto = useCallback(() => {
    setLightboxIndex((i) =>
      i === null ? null : (i + 1) % photos.length,
    );
  }, [photos.length]);

  // Keyboard navigation + focus trap in lightbox.
  useEffect(() => {
    if (lightboxIndex === null) return;
    // Focus the close button on open so keyboard users land inside the dialog.
    closeButtonRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
        return;
      }
      if (e.key === "ArrowLeft") prevPhoto();
      if (e.key === "ArrowRight") nextPhoto();
      // Simple focus trap: keep Tab inside the dialog. The buttons inside
      // the overlay are the only focusable elements, so we wrap Tab order
      // around the close button.
      if (e.key === "Tab") {
        e.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxIndex, closeLightbox, prevPhoto, nextPhoto]);

  // Restore focus to the originating trigger when the lightbox closes.
  useEffect(() => {
    if (lightboxIndex !== null) return;
    const prev = lastFocusedRef.current;
    if (prev && typeof prev.focus === "function") {
      prev.focus();
    }
  }, [lightboxIndex]);

  if (photos.length === 0) return null;

  return (
    <>
      <div
        className="flex h-full flex-col overflow-hidden rounded-[var(--radius-nxt-lg)] border shadow-sm"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex shrink-0 items-center justify-between p-6 pb-4">
          <h3
            className="text-base font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Uitgelicht
          </h3>
          <ImageIcon
            className="h-4 w-4"
            style={{ color: "var(--tenant-accent)" }}
          />
        </div>
        <div className="flex flex-1 flex-col gap-3 px-6 pb-6 pt-0">
          <div className="grid grid-cols-2 grid-rows-2 gap-2">
            {visible.map((p, i) => {
              const accessibleLabel =
                p.title && p.title.trim().length > 0
                  ? `Open foto: ${p.title}`
                  : `Open foto ${start + i + 1}`;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openLightbox(start + i)}
                  aria-label={accessibleLabel}
                  className="group relative aspect-square w-full overflow-hidden rounded-lg transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: "var(--surface-soft)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.media_url}
                    alt={p.title ?? ""}
                    className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="mt-auto flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-secondary)",
                }}
                aria-label="Vorige foto's"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={page === totalPages - 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-secondary)",
                }}
                aria-label="Volgende foto's"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
        >
          <h2 id={dialogTitleId} className="sr-only">
            {photos[lightboxIndex].title ?? `Foto ${lightboxIndex + 1}`}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            aria-label="Sluiten"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prevPhoto();
                }}
                aria-label="Vorige foto"
                className="absolute left-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextPhoto();
                }}
                aria-label="Volgende foto"
                className="absolute right-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[lightboxIndex].media_url}
            alt={photos[lightboxIndex].title ?? ""}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
