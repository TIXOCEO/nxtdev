"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface BellItem {
  id: string;
  title: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationBellProps {
  slug: string;
  unreadCount: number;
  items: BellItem[];
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function NotificationBell({ slug, unreadCount, items }: NotificationBellProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Mijn meldingen"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
          style={{ color: "var(--text-secondary)" }}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
              style={{ backgroundColor: "#dc2626" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-80 p-0">
        <DropdownMenuLabel className="px-3 py-2 text-xs uppercase tracking-wide">
          Meldingen
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nog geen meldingen.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {items.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/t/${slug}/notifications`}
                  className="flex items-start gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-black/5"
                  style={{
                    backgroundColor: it.is_read ? "transparent" : "color-mix(in srgb, var(--tenant-accent) 8%, transparent)",
                  }}
                >
                  <span
                    aria-hidden
                    className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: it.is_read ? "transparent" : "var(--tenant-accent)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="line-clamp-2 text-[13px] font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {it.title}
                    </p>
                    <p
                      className="mt-0.5 text-[11px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {fmt(it.created_at)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <DropdownMenuSeparator />
        <Link
          href={`/t/${slug}/notifications`}
          className="block px-3 py-2.5 text-center text-xs font-semibold transition-colors hover:bg-black/5"
          style={{ color: "var(--tenant-accent)" }}
        >
          Alles bekijken
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
