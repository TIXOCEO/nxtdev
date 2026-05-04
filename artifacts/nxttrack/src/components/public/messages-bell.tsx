"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";

export interface MessagesBellProps {
  slug: string;
  unreadCount: number;
}

export function MessagesBell({ slug, unreadCount }: MessagesBellProps) {
  return (
    <Link
      href={`/t/${slug}/messages`}
      aria-label="Berichten"
      title="Berichten"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
      style={{ color: "var(--text-secondary)" }}
    >
      <MessageSquare className="h-4 w-4" />
      {unreadCount > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
          style={{ backgroundColor: "#dc2626" }}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
