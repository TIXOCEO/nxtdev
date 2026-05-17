"use client";

import Link from "next/link";
import { Home, CalendarDays, MessageSquare, Bell, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PublicNavKey } from "./public-sidebar";

export interface PublicBottomTabBarProps {
  slug: string;
  active?: PublicNavKey;
  isAuthenticated?: boolean;
  unreadCount?: number;
  messagesUnread?: number;
}

interface TabDef {
  key: PublicNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

/**
 * Sprint 78 — Mobile bottom tab-bar. Toont 4-5 primaire tabs voor mobiel,
 * met navy active-state (3px top-accent + navy icon + navy label). Vervangt
 * de hamburger NIET (PublicMobileNav blijft voor secundaire routes).
 */
export function PublicBottomTabBar({
  slug,
  active,
  isAuthenticated,
  unreadCount = 0,
  messagesUnread = 0,
}: PublicBottomTabBarProps) {
  const tabs: TabDef[] = [
    { key: "home", label: "Home", href: `/t/${slug}`, icon: Home },
    { key: "agenda", label: "Agenda", href: `/t/${slug}/schedule`, icon: CalendarDays },
  ];
  if (isAuthenticated) {
    tabs.push({
      key: "messages",
      label: "Berichten",
      href: `/t/${slug}/messages`,
      icon: MessageSquare,
      badge: messagesUnread > 0 ? messagesUnread : undefined,
    });
    tabs.push({
      key: "notifications",
      label: "Meldingen",
      href: `/t/${slug}/notifications`,
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
    });
    tabs.push({
      key: "profile",
      label: "Profiel",
      href: `/t/${slug}/profile`,
      icon: UserRound,
    });
  } else {
    tabs.push({
      key: "inschrijven",
      label: "Inschrijven",
      href: `/t/${slug}/inschrijven`,
      icon: UserRound,
    });
  }

  return (
    <nav
      className="flex h-14 shrink-0 items-stretch border-t md:hidden"
      style={{
        backgroundColor: "var(--bg-nav)",
        borderColor: "var(--surface-border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label="Hoofdnavigatie"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors"
            style={{
              color: isActive ? "var(--brand-navy)" : "var(--text-secondary)",
            }}
          >
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-x-3 top-0 h-[3px] rounded-b-full"
                style={{ backgroundColor: "var(--nav-active-bar)" }}
              />
            )}
            <span className="relative">
              <Icon
                className="h-5 w-5"
                style={{
                  color: isActive ? "var(--nav-active-icon)" : "currentColor",
                }}
              />
              {tab.badge !== undefined && (
                <span
                  className="absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-black"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              )}
            </span>
            <span className="truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
