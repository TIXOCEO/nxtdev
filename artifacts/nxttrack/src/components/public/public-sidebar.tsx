"use client";

import { useEffect, useState } from "react";
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
  FolderOpen,
  MessageSquare,
  Rss,
  CheckSquare,
  TrendingUp,
  Award,
  CreditCard,
  ArrowLeft,
  ArrowRight,
  Globe,
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
  | "documenten"
  | "taken"
  | "voortgang"
  | "lessen"
  | "leerlingen"
  | "diplomas"
  | "betalingen"
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

interface NavItem {
  key: PublicNavKey | string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  children?: NavItem[];
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

/** Publieke secties: Algemeen + Pagina's. */
function buildPublicSections(
  slug: string,
  showProgrammas: boolean,
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

  const sections: NavSection[] = [{ heading: "Algemeen", items: generalItems }];

  const menuRoots = customPages.filter((p) => p.show_in_menu);
  if (menuRoots.length > 0) {
    sections.push({
      heading: "Pagina's",
      items: menuRoots.map((p) => customNodeToItem(slug, p)),
    });
  }
  return sections;
}

/** Rol-secties: Home + Trainer + Mijn sport + Mijn account. */
function buildRoleSections(
  slug: string,
  showKinderen: boolean,
  showGroepen: boolean,
  unreadCount: number,
  messagesUnread: number,
): NavSection[] {
  const sections: NavSection[] = [
    {
      items: [{ key: "home", label: "Home", href: `/t/${slug}`, icon: Home }],
    },
  ];

  if (showGroepen) {
    sections.push({
      heading: "Trainer",
      items: [
        { key: "agenda", label: "Mijn agenda", href: `/t/${slug}/agenda`, icon: CalendarDays },
        { key: "lessen", label: "Mijn lessen", href: `/t/${slug}/schedule`, icon: CalendarDays },
        { key: "leerlingen", label: "Mijn leerlingen", href: `/t/${slug}/leerlingen`, icon: Users },
        { key: "taken", label: "Taken", href: `/t/${slug}/taken`, icon: CheckSquare },
        { key: "documenten", label: "Documenten", href: `/t/${slug}/documenten`, icon: FolderOpen },
      ],
    });
  }

  if (showKinderen) {
    sections.push({
      heading: "Mijn sport",
      items: [
        { key: "voortgang", label: "Voortgang", href: `/t/${slug}/voortgang`, icon: TrendingUp },
        { key: "lessen", label: "Mijn lessen", href: `/t/${slug}/lessen`, icon: CalendarDays },
        { key: "diplomas", label: "Diploma's", href: `/t/${slug}/diplomas`, icon: Award },
        { key: "betalingen", label: "Betalingen", href: `/t/${slug}/betalingen`, icon: CreditCard },
      ],
    });
  }

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

type ShellMode = "role" | "public";

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
  const hasRole = !!isAuthenticated && (showGroepen || showKinderen);

  // Sprint 81 — Twee-panel slider. Default = role-modus voor users met een rol;
  // anders altijd public-modus. Persist in sessionStorage zodat de keuze door
  // navigaties heen blijft.
  const storageKey = `nxt-shell-mode-${tenant.slug}`;
  const [shellMode, setShellMode] = useState<ShellMode>(
    hasRole ? "role" : "public",
  );

  useEffect(() => {
    if (!hasRole) {
      setShellMode("public");
      return;
    }
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored === "role" || stored === "public") {
        setShellMode(stored);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRole]);

  function switchMode(next: ShellMode) {
    setShellMode(next);
    try {
      window.sessionStorage.setItem(storageKey, next);
    } catch {
      /* ignore */
    }
  }

  const publicSections = buildPublicSections(
    tenant.slug,
    !!showProgrammas,
    customPages,
  );
  const roleSections = hasRole
    ? buildRoleSections(
        tenant.slug,
        !!showKinderen,
        !!showGroepen,
        unreadCount,
        messagesUnread,
      )
    : [];

  const initials = initialsFor(tenant.name);
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = !!tenant.logo_url && !logoFailed;

  async function onLogout() {
    onNavigate?.();
    const target =
      buildPublicTenantUrl(tenant.slug, tenant.domain) ?? `/t/${tenant.slug}`;
    await signOutAction(target);
  }

  // Portal-knop label: trainers → Trainerportaal, anders Leerlingportaal.
  const portalLabel = showGroepen ? "Trainerportaal" : "Leerlingportaal";

  return (
    <aside
      className="flex h-full w-full flex-col gap-2 border-r p-4"
      style={{
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="flex flex-col items-center gap-2 px-2 pb-3 pt-2 text-center">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-sm"
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
              className="text-lg font-bold"
              style={{ color: "var(--tenant-accent)" }}
            >
              {initials}
            </span>
          )}
        </div>
        <p
          className="line-clamp-2 text-sm font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {tenant.name}
        </p>
        <p
          className="-mt-1 text-[11px]"
          style={{ color: "var(--text-secondary)", opacity: 0.75 }}
        >
          {hasRole && shellMode === "role"
            ? portalLabel
            : "Publieke pagina"}
        </p>
      </div>

      {/* Sprint 81 — Role-mode top: pijl naar publieke menu. */}
      {hasRole && shellMode === "role" && (
        <button
          type="button"
          onClick={() => switchMode("public")}
          className="mx-1 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors hover:bg-black/5"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          <Globe className="h-4 w-4" />
          <span>Publieke pagina&apos;s</span>
        </button>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Public panel */}
        <nav
          aria-hidden={hasRole && shellMode !== "public"}
          className="absolute inset-0 flex flex-col gap-4 overflow-y-auto pr-1 transition-transform duration-300 ease-out"
          style={{
            transform:
              hasRole && shellMode === "role"
                ? "translateX(-110%)"
                : "translateX(0)",
            pointerEvents:
              hasRole && shellMode !== "public" ? "none" : undefined,
          }}
        >
          {publicSections.map((section, i) => (
            <SidebarSection
              key={section.heading ?? `pub-${i}`}
              section={section}
              active={active}
              customActivePath={customActivePath}
              onNavigate={onNavigate}
            />
          ))}

          {hasRole && (
            <div
              className="mt-auto border-t pt-3"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <button
                type="button"
                onClick={() => switchMode("role")}
                className="inline-flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--tenant-accent) 18%, transparent)",
                  color: "var(--text-primary)",
                }}
              >
                <span>{portalLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </nav>

        {/* Role panel */}
        {hasRole && (
          <nav
            aria-hidden={shellMode !== "role"}
            className="absolute inset-0 flex flex-col gap-4 overflow-y-auto pr-1 transition-transform duration-300 ease-out"
            style={{
              transform:
                shellMode === "role" ? "translateX(0)" : "translateX(110%)",
              pointerEvents: shellMode !== "role" ? "none" : undefined,
            }}
          >
            {roleSections.map((section, i) => (
              <SidebarSection
                key={section.heading ?? `role-${i}`}
                section={section}
                active={active}
                customActivePath={customActivePath}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        )}
      </div>

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
            className="group inline-flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
            style={{
              backgroundColor:
                active === "login"
                  ? "color-mix(in srgb, var(--tenant-accent) 18%, transparent)"
                  : "transparent",
              color: "var(--text-primary)",
            }}
          >
            <LogIn
              className="h-5 w-5"
              style={{ color: "var(--tenant-accent)" }}
            />
            <span>Inloggen</span>
          </Link>
        )}

        <a
          href="https://nxttrack.nl"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          className="mt-1 flex items-center justify-center gap-1.5 px-3 pb-1 pt-2 text-[10px] uppercase tracking-wider transition-opacity hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>Powered by</span>
          <span
            className="font-bold"
            style={{ color: "var(--tenant-accent)" }}
          >
            NXTTRACK
          </span>
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
        className={`group relative inline-flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition-colors ${
          nested ? "ml-4 pl-3 pr-3" : "px-3 py-2.5"
        }`}
        style={{
          backgroundColor: isActive ? "var(--nav-active-bg)" : "transparent",
          color: isActive ? "var(--brand-navy)" : "var(--text-secondary)",
          fontSize: nested ? "0.8125rem" : "0.875rem",
        }}
        onMouseEnter={(e) => {
          if (!isActive)
            e.currentTarget.style.backgroundColor = "var(--nav-hover-bg)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        {isActive && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
            style={{ backgroundColor: "var(--nav-active-bar)" }}
          />
        )}
        <Icon
          className={nested ? "h-3.5 w-3.5" : "h-4 w-4"}
          style={{
            color: isActive ? "var(--nav-active-icon)" : "currentColor",
          }}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge !== undefined && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-primary)",
            }}
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
