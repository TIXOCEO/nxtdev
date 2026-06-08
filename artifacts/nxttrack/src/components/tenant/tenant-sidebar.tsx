"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Files,
  Home,
  ImagePlay,
  LayoutDashboard,
  ListOrdered,
  Mail,
  MailPlus,
  Newspaper,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerminology } from "@/lib/terminology/provider";
import type { Terminology } from "@/lib/terminology/types";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  id: string;
  label?: string;
  items: NavItem[];
}

function buildNavGroups(t: Terminology, showIntake: boolean): NavGroup[] {
  return [
    {
      id: "overview",
      items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/tenant" }],
    },
    {
      id: "daily",
      label: "Vandaag",
      items: [
        { label: t.session_plural, icon: CalendarDays, href: "/tenant/trainings" },
        { label: "Trainer-taken", icon: ClipboardList, href: "/tenant/taken" },
        { label: "Onbemande sessies", icon: Bell, href: "/tenant/planning/onbemand" },
        { label: "Conflicten", icon: AlertTriangle, href: "/tenant/planning/conflicten" },
        { label: "Capaciteit", icon: Activity, href: "/tenant/planning/capaciteit" },
      ],
    },
    {
      id: "people",
      label: `${t.member_plural} & groepen`,
      items: [
        { label: t.member_plural, icon: Users, href: "/tenant/members" },
        { label: t.group_plural, icon: UsersRound, href: "/tenant/groups" },
        { label: t.instructor_plural, icon: Users, href: "/tenant/instructeurs" },
        { label: "Uitnodigingen", icon: MailPlus, href: "/tenant/invites" },
      ],
    },
    {
      id: "programs",
      label: "Programma's",
      items: [
        { label: t.program_plural, icon: Star, href: "/tenant/programmas" },
        { label: t.membership_plan_plural, icon: CreditCard, href: "/tenant/memberships" },
        { label: "Diploma's", icon: Star, href: "/tenant/diplomas" },
        { label: "Voortgang", icon: BarChart3, href: "/tenant/voortgang" },
      ],
    },
    {
      id: "intake",
      label: "Instroom",
      items: [
        ...(showIntake
          ? [
              { label: "Slimme intake", icon: ClipboardList, href: "/tenant/intake" },
              {
                label: "Vrijgekomen plekken",
                icon: ClipboardList,
                href: "/tenant/intake/vrijgekomen-plekken",
              },
              { label: "Intake-formulieren", icon: ClipboardList, href: "/tenant/intake/forms" },
            ]
          : []),
        { label: "Aanmeldingen", icon: ClipboardList, href: "/tenant/registrations" },
        { label: "Intake instellingen", icon: Settings, href: "/tenant/registrations/instellingen" },
      ],
    },
    {
      id: "communication",
      label: "Communicatie",
      items: [
        { label: "Communicatie hub", icon: Mail, href: "/tenant/communication" },
        { label: "Nieuws", icon: Newspaper, href: "/tenant/news" },
        { label: "Events", icon: Star, href: "/tenant/events" },
        { label: "Nieuwsbrieven", icon: Send, href: "/tenant/newsletters" },
        { label: "Meldingen", icon: Bell, href: "/tenant/notifications" },
        { label: "Alerts", icon: AlertTriangle, href: "/tenant/communication/alerts" },
        { label: "E-mail templates", icon: Mail, href: "/tenant/email-templates" },
      ],
    },
    {
      id: "content",
      label: "Website",
      items: [
        { label: "Homepage", icon: Home, href: "/tenant/homepage" },
        { label: "Pagina's", icon: Files, href: "/tenant/pages" },
        { label: "Menu volgorde", icon: ListOrdered, href: "/tenant/pages/menu" },
        { label: "Media Wall", icon: ImagePlay, href: "/tenant/media-wall" },
        { label: "Sponsoren", icon: Star, href: "/tenant/sponsors" },
        { label: "Trainerbio", icon: FileText, href: "/tenant/cms/trainer-bio" },
      ],
    },
    {
      id: "governance",
      label: "Beheer",
      items: [
        { label: "Documenten", icon: FileText, href: "/tenant/documenten" },
        { label: "Social moderatie", icon: ShieldCheck, href: "/tenant/social-moderation" },
        { label: "Clubprofiel", icon: Building2, href: "/tenant/profile" },
        { label: "Instellingen", icon: Settings, href: "/tenant/settings" },
        { label: "Rollen & rechten", icon: ShieldCheck, href: "/tenant/settings/roles" },
        { label: "Audit-log", icon: ScrollText, href: "/tenant/audit" },
      ],
    },
  ];
}

const NXTTRACK_LOGO = "https://dgwebservices.nl/logonxttrack.svg";

export interface TenantSidebarProps {
  tenantName: string;
  primaryColor?: string | null;
  queryString?: string;
  currentVersion?: string | null;
  currentVersionUnseen?: boolean;
  showIntake?: boolean;
}

export function TenantSidebar({
  tenantName,
  primaryColor,
  queryString = "",
  currentVersion,
  currentVersionUnseen,
  showIntake = false,
}: TenantSidebarProps) {
  const pathname = usePathname();
  const terminology = useTerminology();
  const navGroups = buildNavGroups(terminology, showIntake);
  const swatch = primaryColor || "var(--tenant-accent, var(--accent))";

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const group of navGroups) {
      init[group.id] = group.items.some(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
      );
    }
    init.overview = true;
    init.daily = init.daily ?? true;
    return init;
  });

  return (
    <aside
      className="flex h-full w-full flex-col border-r md:w-[260px] md:shrink-0"
      style={{
        backgroundColor: "color-mix(in srgb, var(--shell-panel-strong) 88%, transparent)",
        borderColor: "var(--shell-border)",
        backdropFilter: "blur(18px)",
      }}
    >
      <div className="border-b p-4" style={{ borderColor: "var(--shell-border)" }}>
        <a href="https://nxttrack.nl" target="_blank" rel="noopener noreferrer" className="mb-5 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={NXTTRACK_LOGO} alt="NXTTRACK" className="h-6 w-auto" />
        </a>
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm"
            style={{ backgroundColor: swatch, borderColor: "var(--shell-border)" }}
          >
            <Building2 className="h-5 w-5" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="min-w-0">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-secondary)" }}
            >
              NXTTRACK
            </p>
            <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {tenantName}
            </p>
          </div>
        </div>
        <div
          className="mt-4 rounded-2xl border px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--shell-panel-muted)",
            borderColor: "var(--shell-border)",
            color: "var(--text-secondary)",
          }}
        >
          Beheeromgeving voor planning, instroom, leden en publicatie.
        </div>
      </div>

      <nav className="nxt-scrollbar flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const hasLabel = Boolean(group.label);
          const open = !hasLabel || openGroups[group.id];

          return (
            <div key={group.id} className="space-y-1">
              {hasLabel ? (
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                  }
                  className="nxt-focus-ring flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-black/5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 shrink-0 transition-transform",
                      open ? "rotate-0" : "-rotate-90",
                    )}
                  />
                  <span className="truncate">{group.label}</span>
                </button>
              ) : null}

              {open
                ? group.items.map((item) => {
                    const isActive =
                      item.href === "/tenant"
                        ? pathname === "/tenant"
                        : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={`${item.href}${queryString}`}
                        className={cn(
                          "nxt-focus-ring group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                          isActive ? "shadow-sm" : "hover:bg-black/5",
                        )}
                        style={
                          isActive
                            ? {
                                backgroundColor: "rgba(11, 99, 255, 0.10)",
                                color: "var(--shell-info)",
                              }
                            : { color: "var(--text-secondary)" }
                        }
                      >
                        {isActive ? (
                          <span
                            className="absolute left-0 top-2 h-5 w-0.5 rounded-full"
                            style={{ backgroundColor: "var(--shell-info)" }}
                          />
                        ) : null}
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })
                : null}
            </div>
          );
        })}
      </nav>

      <div
        className="mt-auto flex flex-col gap-2 border-t px-4 py-4"
        style={{ borderColor: "var(--shell-border)", color: "var(--text-secondary)" }}
      >
        <span className="text-[11px]">Powered by NXTTRACK</span>
        {currentVersion ? (
          <Link
            href={`/tenant/releases/${currentVersion}${queryString}`}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider transition-opacity hover:opacity-80"
          >
            <span>v{currentVersion}</span>
            {currentVersionUnseen ? (
              <span
                aria-label="Nieuwe release"
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--shell-danger)" }}
              />
            ) : null}
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
