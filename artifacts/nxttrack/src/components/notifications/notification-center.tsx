"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Bell, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getMyNotificationFeed,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/tenant/notifications";
import { NotificationPopup } from "./notification-popup";

interface FeedItem {
  recipient_id: string;
  notification_id: string;
  title: string;
  content_html: string | null;
  content_text: string | null;
  is_read: boolean;
  created_at: string;
}

const POLL_MS = 15_000;
const SEEN_KEY = "nxt_notif_last_seen";

function readSeen(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}
function writeSeen(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, id);
  } catch {
    /* ignore */
  }
}

function formatRel(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "zojuist";
  if (m < 60) return `${m} min geleden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} uur geleden`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} dag${days === 1 ? "" : "en"} geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "2-digit", month: "short" });
}

export function NotificationCenter() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<FeedItem | null>(null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const initial = useRef(true);

  const refresh = useCallback(async () => {
    const res = await getMyNotificationFeed();
    if (!res.ok) return;
    setItems(res.data.items);
    setUnread(res.data.unread);

    // Detect newly arrived items vs the last seen marker, but skip the very
    // first poll to avoid popping up a flood of historical messages.
    const newest = res.data.items[0];
    if (initial.current) {
      initial.current = false;
      if (newest) writeSeen(newest.notification_id);
      return;
    }
    if (newest && !newest.is_read) {
      const seen = readSeen();
      if (seen !== newest.notification_id) {
        setPopup(newest);
        writeSeen(newest.notification_id);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function onItemClick(item: FeedItem) {
    if (!item.is_read) {
      startTransition(async () => {
        await markNotificationRead(item.recipient_id);
        setItems((prev) =>
          prev.map((i) => (i.recipient_id === item.recipient_id ? { ...i, is_read: true } : i)),
        );
        setUnread((u) => Math.max(0, u - 1));
      });
    }
  }

  function onMarkAll() {
    startTransition(async () => {
      const res = await markAllNotificationsRead();
      if (res.ok) {
        setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
        setUnread(0);
      }
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Meldingen"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-black/5"
        style={{ color: "var(--text-secondary)" }}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
            style={{ backgroundColor: "#dc2626", color: "white" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[320px] max-w-[calc(100vw-1rem)] origin-top-right overflow-hidden rounded-xl border shadow-lg sm:w-[360px]"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-2"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Meldingen
            </p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={onMarkAll}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium hover:bg-black/5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Check className="h-3 w-3" /> Alles gelezen
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-black/5"
                style={{ color: "var(--text-secondary)" }}
                aria-label="Sluiten"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <p
                className="px-4 py-8 text-center text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Geen meldingen.
              </p>
            ) : (
              <ul>
                {items.map((it) => (
                  <li key={it.recipient_id}>
                    <button
                      type="button"
                      onClick={() => onItemClick(it)}
                      className={cn(
                        "block w-full border-b px-3 py-2.5 text-left transition-colors hover:bg-black/5",
                      )}
                      style={{ borderColor: "var(--surface-border)" }}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
                            it.is_read ? "opacity-0" : "",
                          )}
                          style={{ backgroundColor: "#2563eb" }}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {it.title}
                          </p>
                          {it.content_text && (
                            <p
                              className="mt-0.5 line-clamp-2 text-xs"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {it.content_text}
                            </p>
                          )}
                          <p
                            className="mt-1 text-[10px] uppercase tracking-wider"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {formatRel(it.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {popup && (
        <NotificationPopup
          title={popup.title}
          contentText={popup.content_text}
          contentHtml={popup.content_html}
          onClose={() => setPopup(null)}
          onOpen={() => {
            setPopup(null);
            setOpen(true);
          }}
        />
      )}
    </div>
  );
}
