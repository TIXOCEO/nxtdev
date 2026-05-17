import React, { useState } from "react";
import {
  Home,
  Users,
  Award,
  CalendarDays,
  MessageSquare,
  User,
  Settings,
  Bell,
  ChevronRight,
  Menu,
  X,
  Clock,
  MapPin,
  Shirt,
  Calendar,
  Download,
  Share2,
  Trophy,
  TrendingUp,
  PenLine,
  Waves,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = {
  accent: "#b6d83b",
  accentDark: "#7fa823",
  ink: "#0f1e3a",
  inkLight: "#64748b",
  sidebarBg: "#f4f8eb",
  mainBg: "#fbfcf9",
  surface: "#ffffff",
  border: "rgba(15,30,58,0.08)",
  activeBg: "#e8f0d0",
  hoverBg: "#f0f4e0",
  cardShadow: "0 1px 2px rgba(15,30,58,0.04)",
};

interface NavItem {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: "Home" },
  { icon: Users, label: "Mijn kind(eren)" },
  { icon: Award, label: "Afzwemmen & diploma's", active: true },
  { icon: CalendarDays, label: "Mijn lessen" },
  { icon: MessageSquare, label: "Mijn berichten", badge: "2" },
  { icon: User, label: "Profiel" },
  { icon: Settings, label: "Instellingen" },
];

const MOBILE_TABS = [
  { icon: Home, label: "Home" },
  { icon: CalendarDays, label: "Lessen" },
  { icon: TrendingUp, label: "Voortgang" },
  { icon: MessageSquare, label: "Berichten" },
  { icon: User, label: "Profiel" },
];

function Sidebar({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void } = {}) {
  return (
    <aside
      className={mobile
        ? "fixed inset-y-0 left-0 z-50 flex w-[280px] shrink-0 flex-col shadow-2xl"
        : "hidden shrink-0 flex-col lg:flex lg:w-[260px]"}
      style={{
        backgroundColor: COLORS.sidebarBg,
        borderRight: `1px solid ${COLORS.border}`,
        ...(mobile ? { height: "100dvh" } : { position: "sticky", top: 0, height: "100vh" }),
      }}
    >
      {mobile && (
        <button onClick={onClose} className="absolute right-3 top-3 rounded-md p-1.5 hover:bg-black/5" style={{ color: COLORS.ink }} aria-label="Sluit menu">
          <X className="h-5 w-5" />
        </button>
      )}
      <div className="flex flex-col items-center gap-3 px-4 pt-10 pb-6">
        <div
          className={(mobile ? "h-14 w-14 text-lg" : "h-14 w-14 text-lg lg:h-20 lg:w-20 lg:text-2xl") + " flex items-center justify-center rounded-2xl font-bold text-white shadow-sm"}
          style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})` }}
        >
          ZH
        </div>
        <div className="text-center">
          <div className="text-sm font-bold leading-tight lg:text-base" style={{ color: COLORS.ink }}>Zwemschool Houtrust</div>
          <div className="text-[11px] mt-0.5 lg:text-xs" style={{ color: COLORS.inkLight }}>Ouderomgeving</div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        <nav className="flex flex-col gap-1 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className="group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
                style={{
                  color: item.active ? COLORS.ink : COLORS.inkLight,
                  backgroundColor: item.active ? COLORS.activeBg : "transparent",
                }}
                onMouseEnter={(e) => { if (!item.active) e.currentTarget.style.backgroundColor = COLORS.hoverBg; }}
                onMouseLeave={(e) => { if (!item.active) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {item.active && (
                  <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full" style={{ backgroundColor: COLORS.accent }} />
                )}
                <Icon className="h-4 w-4 shrink-0" style={{ color: item.active ? COLORS.accent : "currentColor" }} />
                <span className="flex-1 truncate text-left">{item.label}</span>
                {item.badge && (
                  <span
                    className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: COLORS.accent }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="mt-auto px-4 py-4 text-center" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        <div className="text-[11px]" style={{ color: COLORS.inkLight }}>Powered by <span className="font-bold" style={{ color: COLORS.ink }}>NxtTrack</span></div>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header
      className="hidden h-16 shrink-0 items-center justify-between border-b px-6 lg:flex lg:px-8"
      style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
    >
      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: COLORS.inkLight }}>
        <span>Home</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        <span className="font-bold" style={{ color: COLORS.ink }}>Afzwemmen & diploma's</span>
      </div>
      <div className="flex items-center gap-5">
        <button className="relative">
          <Bell className="h-5 w-5" style={{ color: COLORS.inkLight }} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
          >
            PM
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>Papa of Mama</div>
            <div className="text-[11px]" style={{ color: COLORS.inkLight }}>Ouder van Mila</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileTopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-40 flex h-[54px] items-center justify-between border-b px-4 lg:hidden"
      style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
    >
      <button onClick={onMenu} className="p-1" style={{ color: COLORS.ink }}>
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})` }}
        >
          ZH
        </div>
        <span className="text-sm font-bold" style={{ color: COLORS.ink }}>Houtrust</span>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative">
          <Bell className="h-5 w-5" style={{ color: COLORS.inkLight }} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
        >
          PM
        </div>
      </div>
    </header>
  );
}

function MobileTabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t lg:hidden"
      style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
    >
      {MOBILE_TABS.map((t: any) => {
        const Icon = t.icon;
        return (
          <button key={t.label} className="flex flex-1 flex-col items-center gap-1 py-2">
            <Icon className="h-5 w-5" style={{ color: t.active ? COLORS.accent : COLORS.inkLight }} />
            <span className="text-[10px] font-medium" style={{ color: t.active ? COLORS.accent : COLORS.inkLight }}>
              {t.label}
            </span>
            {t.active && <span className="h-1 w-1 rounded-full" style={{ backgroundColor: COLORS.accent }} />}
          </button>
        );
      })}
    </nav>
  );
}

const UPCOMING_INFO = [
  { icon: Calendar, label: "Datum", value: "Zaterdag 28 juni 2025" },
  { icon: Clock, label: "Tijd", value: "10:30 — 12:00 (inzwemmen 10:15)" },
  { icon: MapPin, label: "Locatie", value: "Zwembad Houtrust, Bad 1" },
  { icon: Shirt, label: "Kleding", value: "Zwemkleding + handdoek + slippers" },
];

export default function Diplomas() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full font-sans" style={{ backgroundColor: COLORS.mainBg }}>
      <Sidebar />
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
          <Sidebar mobile onClose={() => setMobileOpen(false)} />
        </>
      )}
      <MobileTopBar onMenu={() => setMobileOpen(true)} />

      <main className="flex min-w-0 flex-1 flex-col pb-20 pt-[54px] lg:pb-0 lg:pt-0">
        <TopBar />

        <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.ink }}>
              <span className="inline-block h-7 w-1 rounded-full mr-3 align-middle" style={{ backgroundColor: "#1e3a5f" }} />
              Afzwemmen & diploma's 🏆
            </h1>
            <p className="mt-1 text-sm" style={{ color: COLORS.inkLight }}>
              Van uitnodiging tot digitaal diploma
            </p>
          </div>

          {/* Komend afzwemmoment */}
          <Card className="overflow-hidden border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                  Komend afzwemmoment
                </div>
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: COLORS.accent }}
                >
                  Ingepland
                </span>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-md"
                  style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
                >
                  Mi
                </div>
                <div>
                  <div className="text-xl font-bold" style={{ color: COLORS.ink }}>Mila</div>
                  <div className="text-sm" style={{ color: COLORS.inkLight }}>Zwemdiploma A</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {UPCOMING_INFO.map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="flex items-start gap-3 rounded-lg p-3" style={{ backgroundColor: COLORS.mainBg }}>
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: COLORS.activeBg, color: COLORS.accent }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>{row.label}</div>
                        <div className="mt-0.5 text-sm font-semibold" style={{ color: COLORS.ink }}>{row.value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  className="text-white"
                  style={{ backgroundColor: COLORS.accent }}
                >
                  Zet in agenda 📅
                </Button>
                <Button variant="outline" style={{ borderColor: COLORS.border, color: COLORS.ink }}>
                  Bekijk details
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Diploma behaald */}
          <Card
            className="overflow-hidden border-2 shadow-sm"
            style={{ borderColor: "#f59e0b", background: "linear-gradient(135deg, #fffbeb, #fef3c7)" }}
          >
            <CardContent className="p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px] lg:items-center">
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-2xl shadow-md"
                    style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}
                  >
                    <Trophy className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="mt-4 text-2xl font-bold" style={{ color: COLORS.ink }}>
                    Gefeliciteerd! 🎉
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: COLORS.ink }}>
                    Mila heeft <span className="font-bold">Zwemdiploma A</span> behaald
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold" style={{ color: "#92400e" }}>
                    <Calendar className="h-3.5 w-3.5" />
                    Behaald op 29 juni 2025
                  </div>

                  <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <Button
                      className="text-white shadow-md"
                      style={{ background: "linear-gradient(135deg, #fbbf24, #d97706)" }}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      Download diploma (PDF)
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-white"
                      style={{ borderColor: "#fbbf24", color: "#92400e" }}
                    >
                      <Share2 className="mr-1.5 h-4 w-4" />
                      Deel op social media
                    </Button>
                  </div>
                </div>

                {/* Mini-diploma preview */}
                <div
                  className="relative mx-auto flex aspect-[1/1.4] w-full max-w-[240px] flex-col items-center justify-center rounded-xl p-5 text-center text-white shadow-xl"
                  style={{ background: "linear-gradient(160deg, #3b82f6, #06b6d4)" }}
                >
                  <div className="absolute right-3 top-3 text-2xl">⭐</div>
                  <div className="absolute left-3 top-3 text-2xl">🌊</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">Officieel</div>
                  <div className="mt-1 font-serif text-2xl font-bold italic">Diploma</div>
                  <div className="mt-1 text-xs font-semibold text-white/90">Zwemdiploma A</div>
                  <div className="my-3 h-px w-2/3 bg-white/30" />
                  <div className="text-[11px] uppercase tracking-wider text-white/70">Uitgereikt aan</div>
                  <div className="mt-0.5 text-lg font-bold">Mila</div>
                  <div className="mt-3 text-[10px] text-white/70">29 juni 2025</div>
                  <PenLine className="mt-2 h-5 w-5 -rotate-12 text-white/80" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Eerder behaalde diploma's */}
          <div>
            <h2 className="mb-3 text-lg font-bold" style={{ color: COLORS.ink }}>Eerder behaalde diploma's</h2>
            <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "#f1f5f9", color: "#94a3b8" }}
                >
                  <Waves className="h-8 w-8" />
                </div>
                <div className="mt-3 text-sm font-medium" style={{ color: COLORS.inkLight }}>
                  Nog geen eerdere diploma's behaald
                </div>
                <div className="mt-1 text-xs" style={{ color: COLORS.inkLight }}>
                  Zodra Mila een diploma behaalt, verschijnt het hier.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
