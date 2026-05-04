"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

export interface NotificationPopupProps {
  title: string;
  contentText?: string | null;
  contentHtml?: string | null;
  onClose: () => void;
  onOpen?: () => void;
  /** Auto-dismiss delay in ms. Default 7s. */
  duration?: number;
}

/**
 * Sprint 11 — center-screen toast for newly-arrived notifications.
 * Auto-dismisses, fade-in animation, manual close.
 */
export function NotificationPopup({
  title,
  contentText,
  onClose,
  onOpen,
  duration = 7000,
}: NotificationPopupProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger CSS transition on mount.
    const enter = window.setTimeout(() => setVisible(true), 10);
    const exit = window.setTimeout(() => setVisible(false), duration - 250);
    const close = window.setTimeout(() => onClose(), duration);
    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(exit);
      window.clearTimeout(close);
    };
  }, [duration, onClose]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-3 sm:top-6"
      role="status"
      aria-live="polite"
    >
      <div
        className={
          "pointer-events-auto w-full max-w-sm rounded-2xl border p-3 shadow-xl transition-all duration-200 sm:p-4 " +
          (visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0")
        }
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <Bell className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </p>
            {contentText && (
              <p
                className="mt-0.5 line-clamp-2 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {contentText}
              </p>
            )}
            {onOpen && (
              <button
                type="button"
                onClick={onOpen}
                className="mt-2 text-[11px] font-semibold underline"
                style={{ color: "var(--text-primary)" }}
              >
                Bekijken
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-black/5"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
