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
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PartyPopper,
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
  { icon: Users, label: "Mijn kinderen" },
  { icon: Award, label: "Afzwemmen & diploma's" },
  { icon: CalendarDays, label: "Mijn lessen", active: true },
  { icon: MessageSquare, label: "Mijn berichten", badge: "2" },
  { icon: User, label: "Profiel" },
  { icon: Settings, label: "Instellingen" },
];

const MOBILE_TABS = [
  { icon: Home, label: "Home" },
  { icon: CalendarDays, label: "Lessen", active: true },
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

      <div className="mt-auto px-4 py-4 text-center text-[11px]" style={{ borderTop: `1px solid ${COLORS.border}`, color: COLORS.inkLight }}>
        Powered by <span className="font-bold" style={{ color: COLORS.ink }}>NxtTrack</span>
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
        <span className="font-bold" style={{ color: COLORS.ink }}>Mijn lessen</span>
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
        <span className="text-sm font-bold" style={{ color: COLORS.ink }}>Zwemschool Houtrust</span>
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

type ScreenState = "overzicht" | "afzeggen" | "inhaal" | "vakantie";

const STATE_CHIPS: { key: ScreenState; label: string }[] = [
  { key: "overzicht", label: "Overzicht" },
  { key: "afzeggen", label: "Afzeggen" },
  { key: "inhaal", label: "Inhaalmoment" },
  { key: "vakantie", label: "Vakantie" },
];

const UPCOMING_LESSONS = [
  { day: "Ma", date: "20 mei", time: "16:00 - 16:45", level: "Badje 1 — De zeester", instructor: "Lisa", dateBg: "bg-emerald-50", dateColor: "text-emerald-700" },
  { day: "Ma", date: "27 mei", time: "16:00 - 16:45", level: "Badje 1 — De zeester", instructor: "Lisa", dateBg: "bg-emerald-50", dateColor: "text-emerald-700" },
  { day: "Ma", date: "3 jun", time: "16:00 - 16:45", level: "Badje 1 — De zeester", instructor: "Lisa", dateBg: "bg-blue-50", dateColor: "text-blue-700" },
];

const INHAAL_OPTIONS = [
  { day: "Woensdag 22 mei", time: "16:00 - 16:45", level: "Badje 1", spots: "4 plekken vrij", spotsClass: "bg-emerald-100 text-emerald-700", disabled: false },
  { day: "Vrijdag 24 mei", time: "16:00 - 16:45", level: "Badje 1", spots: "2 plekken vrij", spotsClass: "bg-amber-100 text-amber-700", disabled: false, selected: true },
  { day: "Zaterdag 25 mei", time: "09:00 - 09:45", level: "Badje 1", spots: "5 plekken vrij", spotsClass: "bg-emerald-100 text-emerald-700", disabled: false },
  { day: "Woensdag 29 mei", time: "16:00 - 16:45", level: "Badje 1", spots: "Vol", spotsClass: "bg-red-100 text-red-700", disabled: true },
];

const VAKANTIE_NIVEAUS = [
  { level: "Badje 1 — De zeester", emoji: "⭐", gradient: "from-cyan-100 to-blue-100", spots: "6 plekken vrij", spotsClass: "bg-emerald-100 text-emerald-700" },
  { level: "Badje 2 — De schildpad", emoji: "🐢", gradient: "from-emerald-100 to-teal-100", spots: "3 plekken vrij", spotsClass: "bg-amber-100 text-amber-700" },
  { level: "Badje 3 — De dolfijn", emoji: "🐬", gradient: "from-purple-100 to-pink-100", spots: "5 plekken vrij", spotsClass: "bg-emerald-100 text-emerald-700" },
  { level: "Badje 4 — De krokodil", emoji: "🐊", gradient: "from-amber-100 to-orange-100", spots: "Vol", spotsClass: "bg-red-100 text-red-700" },
];

export default function MijnLessen() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [state, setState] = useState<ScreenState>("overzicht");
  const [tab, setTab] = useState<"aankomend" | "verleden">("aankomend");
  const [selectedInhaal, setSelectedInhaal] = useState<number>(1);
  const [toastOpen, setToastOpen] = useState(true);

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

        <div className="mx-auto w-full max-w-md px-4 py-5 sm:py-6">
          {/* Heading */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: COLORS.ink }}>
              <span className="inline-block h-7 w-1 rounded-full mr-3 align-middle" style={{ backgroundColor: "#1e3a5f" }} />
              Mijn lessen 🌟
            </h1>
            <p className="mt-1 text-sm" style={{ color: COLORS.inkLight }}>
              Bekijk, plan of verzet de zwemlessen van je kind.
            </p>
          </div>

          {/* State toggle */}
          <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-xl p-1" style={{ backgroundColor: COLORS.hoverBg }}>
            {STATE_CHIPS.map((c) => (
              <button
                key={c.key}
                onClick={() => setState(c.key)}
                className="flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  backgroundColor: state === c.key ? COLORS.surface : "transparent",
                  color: state === c.key ? COLORS.accent : COLORS.inkLight,
                  boxShadow: state === c.key ? COLORS.cardShadow : "none",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Optional success toast */}
          {toastOpen && (state === "vakantie" || state === "overzicht") && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1 text-xs leading-relaxed" style={{ color: COLORS.ink }}>
                <div className="font-bold">Je inhaalmoment is bevestigd! 🎉</div>
                <div className="mt-0.5" style={{ color: COLORS.inkLight }}>
                  Vrijdag 24 mei · 16:00-16:45 · Badje 1 - De zeester · Top, bedankt! 🎉
                </div>
              </div>
              <button onClick={() => setToastOpen(false)} className="p-0.5 text-emerald-700 hover:text-emerald-900">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* STATE 1: Overzicht */}
          {state === "overzicht" && (
            <div>
              <div className="mb-3 flex gap-1 rounded-xl border p-1" style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface }}>
                {(["aankomend", "verleden"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: tab === t ? COLORS.accent : "transparent",
                      color: tab === t ? "#fff" : COLORS.inkLight,
                    }}
                  >
                    {t === "aankomend" ? "Aankomend" : "Verleden"}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {UPCOMING_LESSONS.map((l, i) => (
                  <Card key={i} className="border-none" style={{ backgroundColor: COLORS.surface, boxShadow: COLORS.cardShadow }}>
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${l.dateBg} ${l.dateColor}`}>
                        <div className="text-[10px] font-bold uppercase">{l.day}</div>
                        <div className="text-sm font-bold leading-none">{l.date}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: COLORS.ink }}>
                          <Clock className="h-3 w-3" />
                          {l.time}
                        </div>
                        <div className="mt-1.5 inline-flex items-center rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                          {l.level}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: COLORS.inkLight }}>
                          <span
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
                            style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}
                          >
                            L
                          </span>
                          Instructeur: <span className="font-semibold" style={{ color: COLORS.ink }}>{l.instructor}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-4 text-center">
                <a href="#" className="text-sm font-semibold" style={{ color: COLORS.accent }}>Bekijk alles →</a>
              </div>
            </div>
          )}

          {/* STATE 2: Afzeggen */}
          {state === "afzeggen" && (
            <div>
              <h2 className="mb-3 text-lg font-bold" style={{ color: COLORS.ink }}>Les afzeggen</h2>
              <div
                className="rounded-2xl border-2 border-dashed p-5 text-center"
                style={{ borderColor: "rgba(239,68,68,0.35)", backgroundColor: "#fff" }}
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-10 w-10 text-red-500" />
                </div>
                <p className="mt-4 text-sm font-semibold" style={{ color: COLORS.ink }}>
                  Weet je zeker dat je deze les wilt afzeggen?
                </p>
                <div className="mt-4 rounded-xl border p-3 text-left" style={{ borderColor: COLORS.border, backgroundColor: COLORS.mainBg }}>
                  <div className="text-xs font-bold" style={{ color: COLORS.ink }}>Maandag 20 mei 2025</div>
                  <div className="mt-1 text-xs" style={{ color: COLORS.inkLight }}>16:00 - 16:45 · Badje 1 — De zeester</div>
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-left">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-[11px] leading-snug text-amber-800">
                    Na het afzeggen kun je een inhaalmoment kiezen indien beschikbaar.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  style={{ borderColor: COLORS.border, color: COLORS.ink }}
                  onClick={() => setState("overzicht")}
                >
                  Nee, terug
                </Button>
                <Button
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: "#ef4444" }}
                  onClick={() => setState("inhaal")}
                >
                  Ja, afzeggen
                </Button>
              </div>
            </div>
          )}

          {/* STATE 3: Inhaalmoment kiezen */}
          {state === "inhaal" && (
            <div className="pb-24">
              <h2 className="mb-3 text-lg font-bold" style={{ color: COLORS.ink }}>Inhaalmoment kiezen</h2>

              <div className="mb-4 rounded-xl border p-3" style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface, boxShadow: COLORS.cardShadow }}>
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>In te halen les</div>
                <div className="mt-1 text-sm font-bold" style={{ color: COLORS.ink }}>Maandag 20 mei 2025</div>
                <div className="mt-0.5 text-xs" style={{ color: COLORS.inkLight }}>16:00 - 16:45 · Badje 1 — De zeester</div>
              </div>

              <div className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                Beschikbare momenten
              </div>

              <div className="flex flex-col gap-2">
                {INHAAL_OPTIONS.map((opt, i) => {
                  const isSelected = selectedInhaal === i;
                  return (
                    <button
                      key={i}
                      onClick={() => !opt.disabled && setSelectedInhaal(i)}
                      disabled={opt.disabled}
                      className="relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        borderColor: isSelected ? COLORS.accent : COLORS.border,
                        backgroundColor: isSelected ? COLORS.activeBg : COLORS.surface,
                        boxShadow: isSelected ? `0 0 0 3px rgba(59,130,246,0.2)` : COLORS.cardShadow,
                      }}
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                        style={{
                          borderColor: isSelected ? COLORS.accent : "#cbd5e1",
                          backgroundColor: isSelected ? COLORS.accent : "transparent",
                        }}
                      >
                        {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold" style={{ color: COLORS.ink }}>{opt.day}</div>
                        <div className="mt-0.5 text-xs" style={{ color: COLORS.inkLight }}>
                          {opt.time} · {opt.level}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${opt.spotsClass}`}>
                        {opt.spots}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md px-4 pb-3 lg:bottom-0 lg:pb-6">
                <Button
                  className="w-full text-white shadow-lg hover:opacity-90"
                  style={{ backgroundColor: COLORS.accent }}
                  onClick={() => { setState("overzicht"); setToastOpen(true); }}
                >
                  Bevestig inhaalmoment
                </Button>
              </div>
            </div>
          )}

          {/* STATE 4: Vakantieplanning */}
          {state === "vakantie" && (
            <div>
              <h2 className="mb-3 text-lg font-bold" style={{ color: COLORS.ink }}>Vakantieplanning</h2>

              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" />
                <div className="text-xs leading-relaxed" style={{ color: COLORS.ink }}>
                  <div className="font-bold">Extra lessen in de vakantie! 🌴</div>
                  <div className="mt-0.5" style={{ color: COLORS.inkLight }}>
                    Blijf lekker doorzwemmen en maak extra vorderingen.
                  </div>
                </div>
              </div>

              <div className="mb-3 rounded-xl border p-3" style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface, boxShadow: COLORS.cardShadow }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold" style={{ color: COLORS.ink }}>Meivakantie 2025</div>
                    <div className="mt-0.5 text-xs" style={{ color: COLORS.inkLight }}>27 april t/m 5 mei</div>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Actief</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {VAKANTIE_NIVEAUS.map((n, i) => (
                  <Card key={i} className="border-none" style={{ backgroundColor: COLORS.surface, boxShadow: COLORS.cardShadow }}>
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${n.gradient} text-2xl`}>
                        {n.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold" style={{ color: COLORS.ink }}>{n.level}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${n.spotsClass}`}>
                            {n.spots}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: COLORS.inkLight }} />
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-4 text-center">
                <a href="#" className="text-sm font-semibold" style={{ color: COLORS.accent }}>Bekijk alle vakanties →</a>
              </div>
            </div>
          )}
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
