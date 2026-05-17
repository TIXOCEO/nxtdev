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
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Sparkles,
  Play,
  TrendingUp,
  Activity,
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
  activeBg: "#e5edf7",
  hoverBg: "#eef2f8",
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
  { icon: Users, label: "Mijn kind(eren)", active: true },
  { icon: Award, label: "Afzwemmen & diploma's" },
  { icon: CalendarDays, label: "Mijn lessen" },
  { icon: MessageSquare, label: "Mijn berichten", badge: "2" },
  { icon: User, label: "Profiel" },
  { icon: Settings, label: "Instellingen" },
];

const MOBILE_TABS = [
  { icon: Home, label: "Home" },
  { icon: CalendarDays, label: "Lessen" },
  { icon: TrendingUp, label: "Voortgang", active: true },
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
                  <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full" style={{ backgroundColor: "#1e3a5f" }} />
                )}
                <Icon className="h-4 w-4 shrink-0" style={{ color: item.active ? "#1e3a5f" : "currentColor" }} />
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
        <span>Mijn kind(eren)</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        <span>Mila</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        <span className="font-bold" style={{ color: COLORS.ink }}>Voortgang</span>
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
      {MOBILE_TABS.map((t) => {
        const Icon = t.icon;
        return (
          <button key={t.label} className="flex flex-1 flex-col items-center gap-1 py-2">
            <Icon className="h-5 w-5" style={{ color: t.active ? "#1e3a5f" : COLORS.inkLight }} />
            <span className="text-[10px] font-medium" style={{ color: t.active ? "#1e3a5f" : COLORS.inkLight }}>
              {t.label}
            </span>
            {t.active && <span className="h-1 w-1 rounded-full" style={{ backgroundColor: "#1e3a5f" }} />}
          </button>
        );
      })}
    </nav>
  );
}

function Donut({ percent, color }: { percent: number; color: string }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const off = c - (percent / 100) * c;
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" className="shrink-0">
      <circle cx={36} cy={36} r={r} stroke="#e2e8f0" strokeWidth={8} fill="none" />
      <circle
        cx={36}
        cy={36}
        r={r}
        stroke={color}
        strokeWidth={8}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
    </svg>
  );
}

interface Part {
  title: string;
  smileys: string[];
}

const PARTS: Part[] = [
  { title: "Uitglijden op de buik", smileys: ["😀", "😀", "😀", "😐", "😢"] },
  { title: "Spetterbenen op je rug", smileys: ["😀", "😀", "😀", "😐", "😢"] },
  { title: "Kicken aan de kant", smileys: ["😀", "😀", "😀", "😐", "😢"] },
  { title: "Springen in het water", smileys: ["😀", "😀", "😀", "😐", "😢"] },
];

export default function Voortgang() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(0);

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
              Zwemdiploma A 🌟
            </h1>
            <p className="mt-1 text-sm" style={{ color: COLORS.inkLight }}>
              Volg de voortgang per module en onderdeel
            </p>
          </div>

          {/* Hero row: 2 stat-cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="relative">
                  <Donut percent={62} color="#10b981" />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: "#10b981" }}>62%</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>Tot volgende module</div>
                  <div className="mt-1 text-3xl font-bold leading-none" style={{ color: COLORS.ink }}>62%</div>
                  <div className="mt-2 text-xs leading-snug" style={{ color: "#059669" }}>
                    Je bent goed op weg! Nog 3 onderdelen in Badje 1
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="relative">
                  <Donut percent={34} color={COLORS.accent} />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: COLORS.accent }}>34%</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>Tot diploma</div>
                  <div className="mt-1 text-3xl font-bold leading-none" style={{ color: COLORS.ink }}>34%</div>
                  <div className="mt-2 text-xs leading-snug" style={{ color: COLORS.accentDark }}>
                    Blijf zo doorgaan! Je zit al ruim een derde van de weg.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actieve module section */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold" style={{ color: COLORS.ink }}>Actieve module</h2>
              <button
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white"
                style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.ink }}
              >
                Voortgangsstijl: Smileys ⭐
              </button>
            </div>

            <Card className="overflow-hidden border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              {/* Mascot card */}
              <div
                className="relative flex h-32 items-center gap-4 px-6"
                style={{ background: "linear-gradient(135deg, #67e8f9, #3b82f6)" }}
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/25 backdrop-blur text-4xl shadow-lg">
                  ⭐
                </div>
                <div className="flex-1 text-white">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Badje 1</span>
                  </div>
                  <div className="mt-1 text-xl font-bold leading-tight sm:text-2xl">De zeester</div>
                  <div className="mt-1 text-xs text-white/85 sm:text-sm">
                    Veiligheid, vertrouwen en spelen in het water
                  </div>
                </div>
              </div>

              {/* Onderdelen list */}
              <CardContent className="p-0">
                <ul>
                  {PARTS.map((p, i) => {
                    const open = expanded === i;
                    return (
                      <li key={p.title} style={{ borderTop: i === 0 ? "none" : `1px solid ${COLORS.border}` }}>
                        <button
                          onClick={() => setExpanded(open ? null : i)}
                          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>{p.title}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-0.5 text-lg sm:text-xl">
                              {p.smileys.map((s, j) => (
                                <span key={j}>{s}</span>
                              ))}
                            </div>
                            {open ? (
                              <ChevronUp className="h-4 w-4" style={{ color: COLORS.inkLight }} />
                            ) : (
                              <ChevronDown className="h-4 w-4" style={{ color: COLORS.inkLight }} />
                            )}
                          </div>
                        </button>
                        {open && (
                          <div className="px-5 pb-5">
                            <p className="text-sm leading-relaxed" style={{ color: COLORS.inkLight }}>
                              Lig je rug drijven en maak kleine spetterbewegingen met je benen. Blijf rustig ademen en kijk naar het plafond.
                            </p>
                            <div
                              className="mt-4 flex h-48 items-center justify-center rounded-xl"
                              style={{ background: "linear-gradient(135deg, #cbd5e1, #93c5fd)" }}
                            >
                              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
                                <Play className="h-6 w-6 ml-0.5" style={{ color: COLORS.accent }} fill={COLORS.accent} />
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>

            <div className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ color: COLORS.inkLight, backgroundColor: COLORS.activeBg }}>
              <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: COLORS.accent }} />
              <span>Slechts één module en één stijl actief: helder voor de instructeur, motiverend voor de leerling.</span>
            </div>
          </div>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
