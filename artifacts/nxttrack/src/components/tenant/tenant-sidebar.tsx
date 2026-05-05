"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Newspaper,
  ClipboardList,
  Users,
  UsersRound,
  CalendarDays,
  CreditCard,
  Building2,
  Mail,
  MailPlus,
  Bell,
  Settings,
  FileText,
  ChevronDown,
  Files,
  ListOrdered,
  ShieldCheck,
  Home,
  AlertTriangle,
  ImagePlay,
  Star,
  Rss,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  id: string;
  label?: string;
  icon?: typeof LayoutDashboard;
  items: NavItem[];
  defaultOpen?: boolean;
}

// Logischer indeling per "what would a club admin actually do today":
//   1. Overzicht (snelle blik)
//   2. Leden & groepen (wie zit er in mijn club)
//   3. Inschrijvingen (binnenkomende aanvragen)
//   4. Trainingen & lidmaatschappen (planning + commercie)
//   5. Communicatie (alle uitgaande berichten)
//   6. Content (publieke website / pagina's / media)
//   7. Instellingen (configuratie, helemaal onderaan)
const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/tenant" },
    ],
  },
  {
    id: "members",
    label: "Leden & groepen",
    items: [
      { label: "Leden",           icon: Users,        href: "/tenant/members" },
      { label: "Uitnodigingen",   icon: MailPlus,     href: "/tenant/invites" },
      { label: "Groepen",         icon: UsersRound,   href: "/tenant/groups" },
    ],
  },
  {
    id: "intake",
    label: "Inschrijvingen",
    items: [
      { label: "Aanmeldingen",    icon: ClipboardList, href: "/tenant/registrations" },
    ],
  },
  {
    id: "planning",
    label: "Planning & lidmaatschap",
    items: [
      { label: "Trainingen",      icon: CalendarDays,  href: "/tenant/trainings" },
      { label: "Lidmaatschappen", icon: CreditCard,    href: "/tenant/memberships" },
    ],
  },
  {
    id: "comm",
    label: "Communicatie",
    items: [
      { label: "Communicatie hub", icon: Mail,         href: "/tenant/communication" },
      { label: "Nieuws",           icon: Newspaper,    href: "/tenant/news" },
      { label: "Nieuwsbrieven",    icon: Send,         href: "/tenant/newsletters" },
      { label: "Alerts",           icon: AlertTriangle, href: "/tenant/communication/alerts" },
      { label: "Meldingen",        icon: Bell,         href: "/tenant/notifications" },
      { label: "E-mail templates", icon: Mail,         href: "/tenant/email-templates" },
      { label: "Social moderatie", icon: ShieldCheck,  href: "/tenant/social-moderation" },
    ],
  },
  {
    id: "content",
    label: "Website & content",
    icon: FileText,
    items: [
      { label: "Homepage",         icon: Home,         href: "/tenant/homepage" },
      { label: "Pagina's",         icon: Files,        href: "/tenant/pages" },
      { label: "Menu volgorde",    icon: ListOrdered,  href: "/tenant/pages/menu" },
      { label: "Media Wall",       icon: ImagePlay,    href: "/tenant/media-wall" },
      { label: "Sponsoren",        icon: Star,         href: "/tenant/sponsors" },
    ],
  },
  {
    id: "config",
    label: "Instellingen",
    items: [
      { label: "Clubprofiel",      icon: Building2,    href: "/tenant/profile" },
      { label: "Algemeen",         icon: Settings,     href: "/tenant/settings" },
      { label: "Rollen & rechten", icon: ShieldCheck,  href: "/tenant/settings/roles" },
    ],
  },
];

const NXTTRACK_LOGO = "https://dgwebservices.nl/logonxttrack.svg";

export interface TenantSidebarProps {
  tenantName: string;
  primaryColor?: string | null;
  /** Query string (incl. leading `?`) preserved across nav links — used by platform admins. */
  queryString?: string;
}

export function TenantSidebar({ tenantName, primaryColor, queryString = "" }: TenantSidebarProps) {
  const pathname = usePathname();
  const swatch = primaryColor || "var(--accent)";

  // Default: open the group that contains the active path.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      init[g.id] = g.items.some(
        (it) => pathname === it.href || pathname.startsWith(it.href + "/"),
      );
    }
    init["main"] = true;
    return init;
  });

  return (
    <aside
      className="flex h-full w-full flex-col border-r md:w-[230px] md:shrink-0"
      style={{
        backgroundColor: "var(--bg-nav)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div
        className="flex items-center gap-3 border-b px-5 py-5"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: swatch }}
        >
          <Building2 className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
        </div>
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            NXTTRACK
          </p>
          <p
            className="truncate text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {tenantName}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          const open = !!openGroups[group.id];
          const hasLabel = !!group.label;

          return (
            <div key={group.id} className="space-y-0.5">
              {hasLabel && (
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors hover:bg-black/5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 shrink-0 transition-transform",
                      open ? "rotate-0" : "-rotate-90",
                    )}
                  />
                  {group.label}
                </button>
              )}
              {(open || !hasLabel) &&
                group.items.map((item) => {
                  const isActive =
                    item.href === "/tenant"
                      ? pathname === "/tenant"
                      : pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={`${item.href}${queryString}`}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150",
                        isActive ? "shadow-sm" : "hover:bg-black/5",
                      )}
                      style={
                        isActive
                          ? { backgroundColor: "var(--accent)", color: "var(--text-primary)" }
                          : { color: "var(--text-secondary)" }
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>

      <a
        href="https://nxttrack.nl"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto flex items-center justify-center gap-2 border-t px-5 py-4 text-[11px] transition-opacity hover:opacity-80"
        style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
      >
        <span>Powered by</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={NXTTRACK_LOGO} alt="NXTTRACK" className="h-4 w-auto" />
      </a>
    </aside>
  );
}
