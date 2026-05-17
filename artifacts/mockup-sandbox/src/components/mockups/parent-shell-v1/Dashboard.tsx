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
  Calendar,
  ShoppingBag,
  Star,
  TrendingUp,
  Menu,
  X,
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
  { icon: Home, label: "Home", active: true },
  { icon: Users, label: "Mijn kind(eren)" },
  { icon: Award, label: "Afzwemmen & diploma's" },
  { icon: CalendarDays, label: "Mijn lessen" },
  { icon: MessageSquare, label: "Mijn berichten", badge: "2" },
  { icon: User, label: "Profiel" },
  { icon: Settings, label: "Instellingen" },
];

const MOBILE_TABS = [
  { icon: Home, label: "Home", active: true },
  { icon: CalendarDays, label: "Lessen" },
  { icon: TrendingUp, label: "Voortgang" },
  { icon: MessageSquare, label: "Berichten" },
  { icon: User, label: "Profiel" },
];

const UPCOMING_LESSONS = [
  { date: "Ma 20 mei", time: "16:00-16:45", group: "Badje 1 — De zeester", trainer: "Lisa" },
  { date: "Ma 27 mei", time: "16:00-16:45", group: "Badje 1 — De zeester", trainer: "Lisa" },
  { date: "Ma 3 jun", time: "16:00-16:45", group: "Badje 2 — De schildpad", trainer: "Lisa" },
];

const MESSAGES = [
  { name: "Zwemschool Demo", text: "Aanmelding voor afzwemmen Mila", time: "09:42", badge: "1", color: "from-blue-400 to-blue-600" },
  { name: "Lisa (instructeur)", text: "Mila deed het top vandaag!", time: "Gisteren", color: "from-purple-400 to-pink-500" },
  { name: "Zwemschool Demo", text: "Vakantieplanning beschikbaar", time: "12 mei", color: "from-amber-400 to-orange-500" },
];

const QUICK_ACTIONS = [
  { emoji: "📅", label: "Les afzeggen", bg: "bg-red-50", color: "text-red-600" },
  { emoji: "🔄", label: "Inhaalmoment plannen", bg: "bg-blue-50", color: "text-blue-600" },
  { emoji: "🌴", label: "Vakantieplanning bekijken", bg: "bg-green-50", color: "text-green-600" },
  { emoji: "💬", label: "Bericht sturen", bg: "bg-purple-50", color: "text-purple-600" },
];

const PROGRESS_MODULES = [
  { label: "Badje 1 — De zeester", pct: 78, color: "bg-green-500" },
  { label: "Badje 2 — De schildpad", pct: 65, color: "bg-green-500" },
  { label: "Badje 3 — De dolfijn", pct: 12, color: "bg-blue-500" },
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
          <div className="text-[11px] mt-0.5 lg:text-xs" style={{ color: COLORS.inkLight }}>Ouder omgeving</div>
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

      <div className="mt-auto px-3 py-3 text-center" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        <div className="text-[11px] font-medium" style={{ color: COLORS.inkLight }}>
          Powered by <span className="font-bold" style={{ color: COLORS.ink }}>NxtTrack</span>
        </div>
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
        <span>Zwemschool Houtrust</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        <span className="font-bold" style={{ color: COLORS.ink }}>Home</span>
      </div>
      <div className="flex items-center gap-5">
        <button className="relative">
          <Bell className="h-5 w-5" style={{ color: COLORS.inkLight }} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})` }}
          >
            PM
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>Papa of Mama</div>
            <div className="text-[11px]" style={{ color: COLORS.inkLight }}>Ouder</div>
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
        <span className="text-sm font-bold" style={{ color: COLORS.ink }}>Zwemschool</span>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative">
          <Bell className="h-5 w-5" style={{ color: COLORS.inkLight }} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})` }}
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
            <Icon className="h-5 w-5" style={{ color: t.active ? COLORS.accent : COLORS.inkLight }} />
            <span className="text-[10px] font-medium" style={{ color: t.active ? COLORS.ink : COLORS.inkLight }}>
              {t.label}
            </span>
            {t.active && <span className="h-1 w-1 rounded-full" style={{ backgroundColor: COLORS.accent }} />}
          </button>
        );
      })}
    </nav>
  );
}

function ProgressDonut({ pct }: { pct: number }) {
  const radius = 38;
  const c = 2 * Math.PI * radius;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} stroke="#e5e7eb" strokeWidth="9" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#22c55e"
          strokeWidth="9"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-lg font-bold text-green-600">{pct}%</div>
        <div className="text-[10px] font-medium" style={{ color: COLORS.inkLight }}>Voortgang</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
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
          {/* Greeting */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.ink }}>
              Welkom, Papa of Mama 👋
            </h1>
            <p className="mt-1 text-sm" style={{ color: COLORS.inkLight }}>
              Hier zie je alles over de zwemlessen en afzwemmen van Mila
            </p>

            {/* Kind selector */}
            <button
              className="mt-4 inline-flex items-center gap-2.5 rounded-full border bg-white px-2 py-1.5 pr-3 shadow-sm transition-all hover:shadow"
              style={{ borderColor: COLORS.border }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #22d3ee, #3b82f6)" }}
              >
                M
              </div>
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Mila</span>
              <ChevronDown className="h-4 w-4" style={{ color: COLORS.inkLight }} />
            </button>
          </div>

          {/* 3-col main grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 1. Komend afzwemmoment */}
            <Card className="flex flex-col border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Komend afzwemmoment</h3>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600">Ingepland</span>
              </div>
              <CardContent className="flex flex-1 flex-col gap-4 p-5 pt-0">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #22d3ee, #3b82f6)" }}
                  >
                    M
                  </div>
                  <div>
                    <div className="text-base font-bold" style={{ color: COLORS.ink }}>Mila</div>
                    <div className="text-xs" style={{ color: COLORS.inkLight }}>Zwemdiploma A</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div className="text-xs leading-relaxed" style={{ color: COLORS.ink }}>
                    <div className="font-semibold">Zaterdag 29 juni 2025</div>
                    <div style={{ color: COLORS.inkLight }}>10:00 uur · Zwembad Houtrust</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 p-3">
                  <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-xs leading-relaxed" style={{ color: COLORS.ink }}>
                    <div className="font-semibold">Kleding & mee te nemen</div>
                    <div style={{ color: COLORS.inkLight }}>Zwemkleding, handdoek, kledingzwem-set</div>
                  </div>
                </div>

                <p className="text-[11px] italic" style={{ color: COLORS.inkLight }}>
                  Graag 15 minuten van tevoren aanwezig.
                </p>

                <Button
                  className="mt-auto w-full text-white"
                  style={{ backgroundColor: COLORS.accent }}
                >
                  Bekijk details →
                </Button>
              </CardContent>
            </Card>

            {/* 2. Diploma's */}
            <Card className="flex flex-col border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Diploma's & prestaties</h3>
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">Behaald</span>
              </div>
              <CardContent className="flex flex-1 flex-col gap-3 p-5 pt-0">
                <div className="flex flex-col items-center gap-2 pt-2">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md"
                    style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}
                  >
                    A
                  </div>
                  <div className="text-center">
                    <div className="text-base font-bold" style={{ color: COLORS.ink }}>Zwemdiploma A</div>
                    <div className="text-xs" style={{ color: COLORS.inkLight }}>Behaald op 29 juni 2025</div>
                  </div>
                </div>

                <p className="text-center text-sm" style={{ color: COLORS.ink }}>
                  Gefeliciteerd Mila! Wat een topprestatie 🏆
                </p>

                <Button className="w-full text-white" style={{ backgroundColor: COLORS.accent }}>
                  Bekijk diploma →
                </Button>

                <div className="mt-auto pt-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                    Eerder behaalde diploma's
                  </div>
                  <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-dashed p-3" style={{ borderColor: COLORS.border }}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                      <Waves className="h-4 w-4" style={{ color: COLORS.inkLight }} />
                    </div>
                    <span className="text-xs" style={{ color: COLORS.inkLight }}>Nog geen eerdere diploma's behaald</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Voortgang */}
            <Card className="flex flex-col border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Voortgang</h3>
                <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk →</a>
              </div>
              <CardContent className="flex flex-1 flex-col gap-3 p-5 pt-0">
                <div
                  className="flex items-center gap-3 rounded-xl p-3 text-white"
                  style={{ background: "linear-gradient(135deg, #22d3ee, #3b82f6)" }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 text-2xl font-bold">
                    M
                  </div>
                  <div>
                    <div className="text-sm font-bold">Mila ⭐</div>
                    <div className="text-[11px] text-white/80">Zwemdiploma A</div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <ProgressDonut pct={62} />
                </div>

                <div className="mt-auto flex flex-col gap-2.5">
                  {PROGRESS_MODULES.map((m) => (
                    <div key={m.label}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium" style={{ color: COLORS.ink }}>{m.label}</span>
                        <span style={{ color: COLORS.inkLight }}>{m.pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${m.color}`} style={{ width: `${m.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 4. Komende lessen */}
            <Card className="flex flex-col border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Komende lessen</h3>
              </div>
              <CardContent className="flex flex-1 flex-col p-5 pt-0">
                <div className="flex flex-col gap-2">
                  {UPCOMING_LESSONS.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        <span className="text-[9px] font-semibold uppercase">{l.date.split(" ")[0]}</span>
                        <span className="text-sm font-bold leading-none">{l.date.split(" ")[1]}</span>
                        <span className="text-[9px]">{l.date.split(" ")[2]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold" style={{ color: COLORS.inkLight }}>{l.time}</div>
                        <div className="truncate text-sm font-semibold" style={{ color: COLORS.ink }}>{l.group}</div>
                      </div>
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: "linear-gradient(135deg, #a78bfa, #ec4899)" }}
                        title={l.trainer}
                      >
                        {l.trainer[0]}
                      </div>
                    </div>
                  ))}
                </div>
                <a href="#" className="mt-auto pt-3 text-xs font-semibold" style={{ color: COLORS.accent }}>
                  Bekijk alle lessen →
                </a>
              </CardContent>
            </Card>

            {/* 5. Berichten */}
            <Card className="flex flex-col border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Berichten</h3>
              </div>
              <CardContent className="flex flex-1 flex-col p-5 pt-0">
                <div className="flex flex-col gap-1">
                  {MESSAGES.map((m, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${m.color} text-xs font-bold text-white`}
                      >
                        {m.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold" style={{ color: COLORS.ink }}>{m.name}</div>
                          <div className="shrink-0 text-[11px]" style={{ color: COLORS.inkLight }}>{m.time}</div>
                        </div>
                        <div className="mt-0.5 truncate text-xs" style={{ color: COLORS.inkLight }}>{m.text}</div>
                      </div>
                      {m.badge && (
                        <span
                          className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                          style={{ backgroundColor: COLORS.ink }}
                        >
                          {m.badge}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <a href="#" className="mt-auto pt-3 text-xs font-semibold" style={{ color: COLORS.accent }}>
                  Open inbox →
                </a>
              </CardContent>
            </Card>

            {/* 6. Snelle acties */}
            <Card className="flex flex-col border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Snelle acties</h3>
              </div>
              <CardContent className="grid grid-cols-2 gap-3 p-5 pt-0">
                {QUICK_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    className="flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all hover:shadow-sm"
                    style={{ borderColor: COLORS.border }}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ${a.bg} ${a.color}`}>
                      {a.emoji}
                    </div>
                    <div className="text-xs font-semibold leading-tight" style={{ color: COLORS.ink }}>{a.label}</div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Footer aanmoediging */}
          <div
            className="flex flex-col items-start gap-4 rounded-2xl p-5 text-white sm:flex-row sm:items-center"
            style={{ background: "linear-gradient(135deg, #22d3ee, #3b82f6)" }}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Star className="h-6 w-6 fill-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold">Mila zit goed op koers!</div>
              <div className="text-sm text-white/85">Nog 5 onderdelen tot Zwemdiploma A. Keep it up 🌟</div>
            </div>
            <div className="w-full sm:w-48">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/80">Voortgang</span>
                <span className="text-sm font-bold">62%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white" style={{ width: "62%" }} />
              </div>
            </div>
          </div>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
