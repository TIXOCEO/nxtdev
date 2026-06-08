"use client";

import Link from "next/link";
import { Home, CalendarDays, MessageSquare, UserRound, TrendingUp, Award } from "lucide-react";
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
  messagesUnread = 0,
}: PublicBottomTabBarProps) {
  const tabs: TabDef[] = [
    { key: "home", label: "Home", href: `/t/${slug}`, icon: Home },
  ];
  if (isAuthenticated) {
    tabs.push({ key: "lessen", label: "Lessen", href: `/t/${slug}/lessen`, icon: CalendarDays });
    tabs.push({ key: "voortgang", label: "Voortgang", href: `/t/${slug}/voortgang`, icon: TrendingUp });
    tabs.push({
      key: "messages",
      label: "Berichten",
      href: `/t/${slug}/messages`,
      icon: MessageSquare,
      badge: messagesUnread > 0 ? messagesUnread : undefined,
    });
    tabs.push({
      key: "profile",
      label: "Profiel",
      href: `/t/${slug}/profile`,
      icon: UserRound,
    });
  } else {
    tabs.push({ key: "agenda", label: "Agenda", href: `/t/${slug}/schedule`, icon: CalendarDays });
    tabs.push({
      key: "inschrijven",
      label: "Inschrijven",
      href: `/t/${slug}/inschrijven`,
      icon: Award,
    });
    tabs.push({ key: "login", label: "Login", href: `/t/${slug}/login`, icon: UserRound });
  }

  return (
    <nav
      className="nxt-public-bottom-tabs flex shrink-0 items-stretch md:hidden"
      style={{
        backgroundColor: "color-mix(in srgb, var(--shell-panel-strong) 88%, transparent)",
        borderColor: "var(--shell-border)",
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
            className="nxt-public-bottom-tab nxt-focus-ring relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-semibold transition-colors"
            style={{
              color: isActive ? "var(--shell-info)" : "var(--text-secondary)",
              backgroundColor: "transparent",
            }}
          >
            <span
              className="relative flex h-8 w-8 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: isActive
                  ? "color-mix(in srgb, var(--shell-info) 12%, var(--shell-panel-strong))"
                  : "transparent",
              }}
            >
              <Icon
                className="h-[18px] w-[18px]"
                style={{
                  color: isActive ? "var(--shell-info)" : "currentColor",
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
