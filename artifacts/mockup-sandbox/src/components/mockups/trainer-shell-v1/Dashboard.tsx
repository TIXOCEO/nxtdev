import React, { useState } from "react";
import {
  Home,
  CalendarDays,
  BookOpen,
  Users,
  MessageSquare,
  Users2,
  CheckSquare,
  FileText,
  Library,
  Settings,
  Bell,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  FileEdit,
  Package,
  TrendingUp,
  Menu,
  User,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = {
  accent: "#b6d83b",
  ink: "#0f1e3a",
  inkLight: "#5b6a83",
  sidebarBg: "#f4f8eb",
  mainBg: "#fbfcf9",
  surface: "#ffffff",
  border: "#e5eada",
  activeBg: "#e8f0d0",
  hoverBg: "#f0f4e0",
  mint: "#eef5d8",
};

interface NavItem {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: "Dashboard", active: true },
  { icon: CalendarDays, label: "Agenda" },
  { icon: BookOpen, label: "Mijn lessen" },
  { icon: Users, label: "Leerlingen" },
  { icon: MessageSquare, label: "Berichten", badge: "5" },
  { icon: Users2, label: "Groepen" },
  { icon: CheckSquare, label: "Taken", badge: "2" },
  { icon: FileText, label: "Documenten" },
  { icon: Library, label: "Handleidingen" },
];

const STATS = [
  { label: "Lessen vandaag", value: "6", icon: CalendarDays, chipBg: COLORS.mint, chipColor: COLORS.accent },
  { label: "Leerlingen vandaag", value: "53", icon: Users, chipBg: COLORS.mint, chipColor: COLORS.accent },
  { label: "Absenties", value: "2", icon: AlertCircle, chipClass: "bg-red-50 text-red-600" },
  { label: "Taken openstaand", value: "2", icon: CheckSquare, chipClass: "bg-amber-50 text-amber-600" },
];

const SESSIONS = [
  { time: "08:30-09:15", title: "Badje 1 — De zeester", sub: "Vertrouwen in het water", attend: "8/12 aanwezig", pool: "Badje 1", status: "Bezig", dot: "bg-green-500", active: true },
  { time: "09:30-10:15", title: "Badje 2 — De schildpad", sub: "Drijven en voortbewegen", attend: "10/10 aanwezig", pool: "Badje 2", status: "Volgende", dot: "bg-blue-500" },
  { time: "10:30-11:15", title: "Badje 3 — De waterval", sub: "Waterveiligheid", attend: "11/11 leerlingen", pool: "Badje 1", status: "Later", dot: "bg-slate-300" },
  { time: "11:30-12:15", title: "Privéles 1-op-1", sub: "", attend: "1 leerling", pool: "Badje 3", status: "Later", dot: "bg-slate-300" },
  { time: "13:30-14:15", title: "Badje 4 — De krokodil", sub: "Schoolslag introductie", attend: "9 leerlingen", pool: "Badje 2", status: "Later", dot: "bg-slate-300" },
  { time: "14:30-15:15", title: "Badje 2 — De schildpad", sub: "", attend: "10 leerlingen", pool: "Badje 2", status: "Later", dot: "bg-slate-300" },
];

const MESSAGES = [
  { name: "Emma de Jong", meta: "ouder van Lisa", text: "Bedankt voor de fijne les van vandaag!", time: "09:21", badge: "2" },
  { name: "Team instructeurs", meta: "", text: "Teamoverleg woensdag 20 mei om 19:00 uur", time: "08:47", badge: "1" },
  { name: "Mark Jansen", meta: "", text: "Kun je morgen mijn les overnemen om 10:30?", time: "Gisteren" },
  { name: "Lisa de Vries", meta: "ouder van Noah", text: "Noah heeft zijn badge gehaald!", time: "Gisteren" },
];

const INTERNAL = [
  { icon: AlertTriangle, title: "Let op: Oefenwedstrijden", text: "Zaterdag 24 mei zijn er oefenwedstrijden. Zorg dat je leerlingen op tijd aanwezig zijn.", date: "10 mei 2026", bg: "bg-amber-50 border-amber-200", chip: "bg-amber-100 text-amber-700" },
  { icon: Info, title: "EHBO herhaling", text: "Volgende week dinsdag 21 mei 19:00–21:00. Locatie: vergaderruimte.", date: "08 mei 2026", bg: "bg-blue-50 border-blue-200", chip: "bg-blue-100 text-blue-700" },
  { icon: CheckCircle, title: "Materialen check", text: "Controleer voor je lessen of al het materiaal compleet is. Dank!", date: "07 mei 2026", bg: "bg-green-50 border-green-200", chip: "bg-green-100 text-green-700" },
];

const QUICK_ACTIONS = [
  { icon: AlertCircle, label: "Les absentie melden", bg: "bg-red-50", color: "text-red-600" },
  { icon: MessageSquare, label: "Bericht sturen", bg: "bg-blue-50", color: "text-blue-600" },
  { icon: FileEdit, label: "Lesnotitie toevoegen", bg: "", color: "" },
  { icon: Package, label: "Materiaal reserveren", bg: "bg-amber-50", color: "text-amber-600" },
];

const MOBILE_TABS = [
  { icon: Home, label: "Home", active: true },
  { icon: CalendarDays, label: "Agenda" },
  { icon: BookOpen, label: "Lessen" },
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
      <div className="flex flex-col items-center gap-2 px-4 pt-8 pb-6">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl font-bold shadow-sm"
          style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
        >
          ZH
        </div>
        <div className="text-center">
          <div className="text-sm font-bold leading-tight" style={{ color: COLORS.ink }}>Zwemschool Houtrust</div>
          <div className="text-[11px] mt-0.5" style={{ color: COLORS.inkLight }}>Trainer omgeving</div>
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
                    style={{ backgroundColor: COLORS.ink }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="mt-auto px-3 py-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        <button
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
          style={{ color: COLORS.inkLight }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Instellingen</span>
        </button>
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
        <span className="font-bold" style={{ color: COLORS.ink }}>Vandaag</span>
      </div>
      <div className="flex items-center gap-5">
        <button className="relative">
          <Bell className="h-5 w-5" style={{ color: COLORS.inkLight }} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: COLORS.ink }}
          >
            SJ
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>Sophie Jansen</div>
            <div className="text-[11px]" style={{ color: COLORS.inkLight }}>Instructeur</div>
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
          className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold"
          style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
        >
          NT
        </div>
        <span className="text-sm font-bold" style={{ color: COLORS.ink }}>NxtTrack</span>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative">
          <Bell className="h-5 w-5" style={{ color: COLORS.inkLight }} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: COLORS.ink }}
        >
          SJ
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
            <Icon className="h-5 w-5" style={{ color: t.active ? COLORS.ink : COLORS.inkLight }} />
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
              Goedemorgen, Sophie!
            </h1>
            <p className="mt-1 text-sm" style={{ color: COLORS.inkLight }}>
              Hier is jouw overzicht van vandaag — donderdag 15 mei 2026
            </p>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {STATS.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.chipClass ?? ""}`}
                      style={s.chipClass ? undefined : { backgroundColor: s.chipBg, color: s.chipColor }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold leading-none" style={{ color: COLORS.ink }}>{s.value}</div>
                      <div className="mt-1 text-xs" style={{ color: COLORS.inkLight }}>{s.label}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 3-column row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:[grid-auto-rows:380px]">
            {/* Agenda */}
            <Card className="flex h-full flex-col border-none shadow-sm lg:overflow-hidden" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Agenda vandaag</h3>
                <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk volledige agenda →</a>
              </div>
              <CardContent className="flex flex-1 flex-col p-0 lg:overflow-hidden">
                <ScrollArea className="h-full px-3 pb-4">
                  <div className="flex flex-col gap-1.5">
                    {SESSIONS.map((s, i) => (
                      <div
                        key={i}
                        className="relative rounded-lg px-3 py-2.5"
                        style={{ backgroundColor: s.active ? COLORS.activeBg : "transparent" }}
                      >
                        {s.active && (
                          <div className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full" style={{ backgroundColor: COLORS.accent }} />
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold" style={{ color: COLORS.inkLight }}>{s.time}</div>
                            <div className="mt-0.5 truncate text-sm font-semibold" style={{ color: COLORS.ink }}>{s.title}</div>
                            {s.sub && <div className="truncate text-xs" style={{ color: COLORS.inkLight }}>{s.sub}</div>}
                            <div className="mt-1 text-[11px]" style={{ color: COLORS.inkLight }}>
                              {s.attend} · {s.pool}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                            <span className="text-[11px] font-medium" style={{ color: COLORS.inkLight }}>{s.status}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Berichten */}
            <Card className="flex h-full flex-col border-none shadow-sm lg:overflow-hidden" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Berichten</h3>
                <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk alles →</a>
              </div>
              <CardContent className="flex flex-1 flex-col p-0 lg:overflow-hidden">
                <ScrollArea className="h-full px-3 pb-4">
                  <div className="flex flex-col gap-1">
                    {MESSAGES.map((m, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-black/5">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{ backgroundColor: COLORS.mint, color: COLORS.accent }}
                        >
                          {m.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-sm font-semibold" style={{ color: COLORS.ink }}>
                              {m.name}
                              {m.meta && <span className="ml-1 text-xs font-normal" style={{ color: COLORS.inkLight }}>({m.meta})</span>}
                            </div>
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
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Interne berichten */}
            <Card className="flex h-full flex-col border-none shadow-sm lg:overflow-hidden" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Interne berichten</h3>
                <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk alles →</a>
              </div>
              <CardContent className="flex flex-1 flex-col p-0 lg:overflow-hidden">
                <ScrollArea className="h-full px-4 pb-4">
                  <div className="flex flex-col gap-3">
                    {INTERNAL.map((n, i) => {
                      const Icon = n.icon;
                      return (
                        <div key={i} className={`rounded-lg border p-3 ${n.bg}`}>
                          <div className="flex items-start gap-2.5">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.chip}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>{n.title}</div>
                              <div className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.inkLight }}>{n.text}</div>
                              <div className="mt-1.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: COLORS.inkLight }}>{n.date}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Snel acties */}
            <Card className="border-none shadow-sm lg:col-span-2" style={{ backgroundColor: COLORS.surface }}>
              <div className="p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Snel acties</h3>
              </div>
              <CardContent className="grid grid-cols-2 gap-3 p-5 pt-0">
                {QUICK_ACTIONS.map((a) => {
                  const Icon = a.icon;
                  const isMint = !a.bg;
                  return (
                    <button
                      key={a.label}
                      className="flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-sm"
                      style={{ borderColor: COLORS.border }}
                    >
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.bg} ${a.color}`}
                        style={isMint ? { backgroundColor: COLORS.mint, color: COLORS.accent } : undefined}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>{a.label}</div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Week voortgang */}
            <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.ink }}>
              <CardContent className="flex h-full flex-col p-5 text-white">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "rgba(182,216,59,0.15)", color: COLORS.accent }}
                  >
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="text-base font-bold">Top!</div>
                </div>
                <p className="mt-3 text-sm text-white/80">
                  Deze week al 85% van je lessen gegeven. Keep it up!
                </p>
                <div className="mt-auto pt-5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-white/70">Week voortgang</div>
                    <div className="text-sm font-bold" style={{ color: COLORS.accent }}>85%</div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: "85%", backgroundColor: COLORS.accent }} />
                  </div>
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
