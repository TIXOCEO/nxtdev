"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Home,
  Newspaper,
  CalendarPlus,
  CalendarDays,
  ClipboardList,
  LogIn,
  LogOut,
  Bell,
  UserRound,
  Users,
  Layers,
  Settings,
  FileText,
  MessageSquare,
  Rss,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tenant } from "@/types/database";
import type { CustomPageNode } from "@/lib/db/custom-pages";
import { signOutAction } from "@/lib/actions/auth";
import { buildPublicTenantUrl } from "@/lib/tenant/public-url";

export type PublicNavKey =
  | "home"
  | "nieuws"
  | "agenda"
  | "proefles"
  | "programmas"
  | "inschrijven"
  | "login"
  | "notifications"
  | "profile"
  | "kinderen"
  | "groepen"
  | "instellingen"
  | "messages"
  | "feed"
  | "custom";

export interface PublicSidebarProps {
  tenant: Tenant;
  active?: PublicNavKey;
  isAuthenticated?: boolean;
  showKinderen?: boolean;
  showGroepen?: boolean;
  /** Sprint 63 — Toont alleen wanneer tenant ≥1 publiek programma heeft. */
  showProgrammas?: boolean;
  unreadCount?: number;
  messagesUnread?: number;
  /** Tenant-defined pages, already filtered for visibility. */
  customPages?: CustomPageNode[];
  /** Path of the current custom page, e.g. "info/contact". */
  customActivePath?: string;
  /** Pre-rendered social bar (server component) shown above the footer. */
  socialBar?: React.ReactNode;
  onNavigate?: () => void;
}

const NXTTRACK_LOGO = "https://dgwebservices.nl/logonxttrack.svg";

interface NavItem {
  key: PublicNavKey | string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  children?: NavItem[];
  /** For custom pages — match against customActivePath. */
  customPath?: string;
}

interface NavSection {
  heading?: string;
  items: NavItem[];
}

function customNodeToItem(slug: string, node: CustomPageNode): NavItem {
  const href = `/t/${slug}/p/${node.path}`;
  const visibleChildren = node.children.filter((c) => c.show_in_menu);
  return {
    key: `custom:${node.id}`,
    label: node.title,
    href,
    icon: FileText,
    customPath: node.path,
    children:
      visibleChildren.length > 0
        ? visibleChildren.map((c) => customNodeToItem(slug, c))
        : undefined,
  };
}

function buildSections(
  slug: string,
  isAuthed: boolean,
  showKinderen: boolean,
  showGroepen: boolean,
  showProgrammas: boolean,
  unreadCount: number,
  messagesUnread: number,
  customPages: CustomPageNode[],
): NavSection[] {
  const generalItems: NavItem[] = [
    { key: "home", label: "Home", href: `/t/${slug}`, icon: Home },
    { key: "nieuws", label: "Nieuws", href: `/t/${slug}/nieuws`, icon: Newspaper },
    { key: "agenda", label: "Agenda", href: `/t/${slug}/schedule`, icon: CalendarDays },
    { key: "feed", label: "Feed", href: `/t/${slug}/feed`, icon: Rss },
    { key: "proefles", label: "Proefles", href: `/t/${slug}/proefles`, icon: CalendarPlus },
  ];
  if (showProgrammas) {
    generalItems.push({
      key: "programmas",
      label: "Programma's",
      href: `/t/${slug}/programmas`,
      icon: Layers,
    });
  }
  generalItems.push({
    key: "inschrijven",
    label: "Inschrijven",
    href: `/t/${slug}/inschrijven`,
    icon: ClipboardList,
  });
  const general: NavSection = { heading: "Algemeen", items: generalItems };

  const sections: NavSection[] = [general];

  // Custom pages — only show roots flagged show_in_menu.
  const menuRoots = customPages.filter((p) => p.show_in_menu);
  if (menuRoots.length > 0) {
    sections.push({
      heading: "Pagina's",
      items: menuRoots.map((p) => customNodeToItem(slug, p)),
    });
  }

  if (!isAuthed) return sections;

  const profileChildren: NavItem[] = [];
  if (showKinderen) {
    profileChildren.push({
      key: "kinderen",
      label: "Mijn kinderen",
      href: `/t/${slug}/profile`,
      icon: Users,
    });
  }
  if (showGroepen) {
    profileChildren.push({
      key: "groepen",
      label: "Mijn groepen",
      href: `/t/${slug}/profile`,
      icon: Layers,
    });
  }

  sections.push({
    heading: "Mijn account",
    items: [
      {
        key: "messages",
        label: "Berichten",
        href: `/t/${slug}/messages`,
        icon: MessageSquare,
        badge: messagesUnread > 0 ? messagesUnread : undefined,
      },
      {
        key: "notifications",
        label: "Mijn meldingen",
        href: `/t/${slug}/notifications`,
        icon: Bell,
        badge: unreadCount > 0 ? unreadCount : undefined,
      },
      {
        key: "profile",
        label: "Mijn profiel",
        href: `/t/${slug}/profile`,
        icon: UserRound,
        children: profileChildren.length > 0 ? profileChildren : undefined,
      },
      {
        key: "instellingen",
        label: "Mijn instellingen",
        href: `/t/${slug}/instellingen`,
        icon: Settings,
      },
    ],
  });

  return sections;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PublicSidebar({
  tenant,
  active,
  isAuthenticated,
  showKinderen,
  showGroepen,
  showProgrammas,
  unreadCount = 0,
  messagesUnread = 0,
  customPages = [],
  customActivePath,
  socialBar,
  onNavigate,
}: PublicSidebarProps) {
  const sections = buildSections(
    tenant.slug,
    !!isAuthenticated,
    !!showKinderen,
    !!showGroepen,
    !!showProgrammas,
    unreadCount,
    messagesUnread,
    customPages,
  );
  const initials = initialsFor(tenant.name);
  // Wanneer tenant.logo_url een 404 of broken image teruggeeft, vallen we
  // visueel terug op de initialen i.p.v. een kapot afbeelding-icoontje.
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = !!tenant.logo_url && !logoFailed;

  async function onLogout() {
    onNavigate?.();
    const target =
      buildPublicTenantUrl(tenant.slug, tenant.domain) ?? `/t/${tenant.slug}`;
    await signOutAction(target);
  }

  return (
    <aside
      className="flex h-full w-full flex-col gap-2 border-r p-4"
      style={{
        backgroundColor: "var(--bg-nav)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="flex flex-col items-center gap-2 px-2 pb-3 pt-2 text-center">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: "var(--surface-main)",
          }}
        >
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo_url!}
              alt={tenant.name}
              className="h-full w-full object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <span
              className="text-base font-bold"
              style={{ color: "var(--tenant-accent)" }}
            >
              {initials}
            </span>
          )}
        </div>
        <p
          className="line-clamp-2 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {tenant.name}
        </p>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {sections.map((section, i) => (
          <SidebarSection
            key={section.heading ?? `section-${i}`}
            section={section}
            active={active}
            customActivePath={customActivePath}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {socialBar && (
        <div
          className="border-t"
          style={{ borderColor: "var(--surface-border)" }}
        >
          {socialBar}
        </div>
      )}

      <div
        className="mt-2 flex flex-col gap-1 border-t pt-3"
        style={{ borderColor: "var(--surface-border)" }}
      >
        {isAuthenticated ? (
          <form action={onLogout}>
            <button
              type="submit"
              className="group inline-flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-black/5"
              style={{ color: "#b91c1c" }}
            >
              <LogOut className="h-4 w-4" />
              <span>Uitloggen</span>
            </button>
          </form>
        ) : (
          <Link
            href={`/t/${tenant.slug}/login`}
            onClick={onNavigate}
            className="group inline-flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-black/5"
            style={{
              backgroundColor: active === "login"
                ? "color-mix(in srgb, var(--tenant-accent) 18%, transparent)"
                : "transparent",
              color: active === "login" ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            <LogIn
              className="h-4 w-4"
              style={{
                color: active === "login" ? "var(--tenant-accent)" : "currentColor",
              }}
            />
            <span>Inloggen</span>
          </Link>
        )}

        <a
          href="https://nxttrack.nl"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          className="mt-1 flex items-center justify-center gap-2 px-3 pb-1 pt-2 text-[11px] transition-opacity hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>Powered by</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={NXTTRACK_LOGO} alt="NXTTRACK" className="h-4 w-auto" />
        </a>
      </div>
    </aside>
  );
}

interface SidebarSectionProps {
  section: NavSection;
  active?: PublicNavKey;
  customActivePath?: string;
  onNavigate?: () => void;
}

function SidebarSection({
  section,
  active,
  customActivePath,
  onNavigate,
}: SidebarSectionProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {section.heading && (
        <p
          className="px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{ color: "var(--text-secondary)", opacity: 0.7 }}
        >
          {section.heading}
        </p>
      )}
      {section.items.map((item) => (
        <SidebarLinkRow
          key={item.key}
          item={item}
          active={active}
          customActivePath={customActivePath}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

interface SidebarLinkRowProps {
  item: NavItem;
  active?: PublicNavKey;
  customActivePath?: string;
  onNavigate?: () => void;
  nested?: boolean;
}

function SidebarLinkRow({
  item,
  active,
  customActivePath,
  onNavigate,
  nested,
}: SidebarLinkRowProps) {
  const Icon = item.icon;
  const isCustom = !!item.customPath;
  const isActive = isCustom
    ? !!customActivePath && customActivePath === item.customPath
    : active === item.key;
  return (
    <>
      <Link
        href={item.href}
        onClick={onNavigate}
        className={`group inline-flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition-colors hover:bg-black/5 ${
          nested ? "ml-4 pl-3 pr-3" : "px-3 py-2.5"
        }`}
        style={{
          backgroundColor: isActive
            ? "color-mix(in srgb, var(--tenant-accent) 18%, transparent)"
            : "transparent",
          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
          fontSize: nested ? "0.8125rem" : "0.875rem",
        }}
      >
        <Icon
          className={nested ? "h-3.5 w-3.5" : "h-4 w-4"}
          style={{ color: isActive ? "var(--tenant-accent)" : "currentColor" }}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge !== undefined && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none text-white"
            style={{ backgroundColor: "#dc2626" }}
          >
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        )}
      </Link>

      {item.children && item.children.length > 0 && (
        <div
          className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l pb-1 pl-2"
          style={{ borderColor: "var(--surface-border)" }}
        >
          {item.children.map((c) => (
            <SidebarLinkRow
              key={c.key}
              item={c}
              active={active}
              customActivePath={customActivePath}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      )}
    </>
  );
}
