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
  ChevronLeft,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  FileEdit,
  Package,
  Menu,
  User,
  X,
  Calendar,
  Sunrise,
  Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = {
  accent: "#b6d83b",
  ink: "#0f1e3a",
  inkLight: "#5b6a83",
  sidebarBg: "#f4f8eb",
  mainBg: "#fbfcf9",
  surface: "#ffffff",
  border: "#e5eada",
  cardBorder: "rgba(15,30,58,0.08)",
  activeBg: "#e8f0d0",
  hoverBg: "#f0f4e0",
  mint: "#eef5d8",
  statBlueChipBg: "#e0f0ff",
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

const SESSIONS = [
  { time: "08:30-09:15", title: "Badje 1 — De zeester", sub: "Vertrouwen in het water", attend: "8/12 aanwezig", pool: "Badje 1", status: "Bezig", pill: "green", active: true },
  { time: "09:30-10:15", title: "Badje 2 — De schildpad", sub: "Drijven en voortbewegen", attend: "10/10 aanwezig", pool: "Badje 2", status: "Volgende", pill: "blue" },
  { time: "10:30-11:15", title: "Badje 3 — De waterval", sub: "Waterveiligheid", attend: "11/11 leerlingen", pool: "Badje 1", status: "Later", pill: "gray" },
  { time: "11:30-12:15", title: "Privéles 1-op-1", sub: "", attend: "1 leerling", pool: "Badje 3", status: "Later", pill: "gray" },
  { time: "13:30-14:15", title: "Badje 4 — De krokodil", sub: "Schoolslag introductie", attend: "9 leerlingen", pool: "Badje 2", status: "Later", pill: "gray" },
  { time: "14:30-15:15", title: "Badje 2 — De schildpad", sub: "", attend: "10 leerlingen", pool: "Badje 2", status: "Later", pill: "gray" },
];

const MESSAGES = [
  { name: "Emma de Jong", meta: "ouder van Lisa", text: "Bedankt voor de fijne les van vandaag!", time: "09:21", badge: "2" },
  { name: "Team instructeurs", meta: "", text: "Teamoverleg woensdag 14 mei om 19:00 uur", time: "08:47", badge: "1" },
  { name: "Mark Jansen", meta: "", text: "Kun je morgen mijn les overnemen om 10:30?", time: "Gisteren" },
  { name: "Lisa de Vries", meta: "ouder van Noah", text: "Noah heeft zijn badge gehaald!", time: "Gisteren" },
];

const INTERNAL = [
  { icon: AlertTriangle, title: "Let op: Oefenwedstrijden", text: "Zaterdag 24 mei zijn er oefenwedstrijden. Zorg dat je leerlingen op tijd aanwezig zijn.", date: "10 mei 2025", bg: "bg-amber-50 border-amber-200", chip: "bg-amber-100 text-amber-700" },
  { icon: Info, title: "EHBO herhaling", text: "Volgende week dinsdag 21 mei 19:00–21:00. Locatie: vergaderruimte.", date: "08 mei 2025", bg: "bg-blue-50 border-blue-200", chip: "bg-blue-100 text-blue-700" },
  { icon: CheckCircle, title: "Materialen check", text: "Controleer voor je lessen of al het materiaal compleet is. Dank!", date: "07 mei 2025", bg: "bg-green-50 border-green-200", chip: "bg-green-100 text-green-700" },
];

const QUICK_ACTIONS = [
  { icon: AlertCircle, label: "Les absentie melden", sub: "Geef een les door of meld je af", bg: "bg-red-50", color: "text-red-600" },
  { icon: MessageSquare, label: "Bericht sturen", sub: "Naar ouder, leerling of collega", bg: "bg-blue-50", color: "text-blue-600" },
  { icon: FileEdit, label: "Lesnotitie toevoegen", sub: "Registratie of bijzonderheden", bg: "", color: "" },
  { icon: Package, label: "Materiaal reserveren", sub: "Reserveer materialen voor je les", bg: "bg-amber-50", color: "text-amber-600" },
];

const OVERVIEW = [
  { label: "Lessen vandaag", value: "6", icon: CalendarDays, chipBg: COLORS.mint, chipColor: COLORS.accent },
  { label: "Leerlingen vandaag", value: "53", icon: Users, chipBg: COLORS.mint, chipColor: COLORS.accent },
  { label: "Absenties", value: "2", icon: AlertCircle, chipClass: "bg-red-50 text-red-600" },
  { label: "Taken openstaand", value: "2", icon: CheckSquare, chipClass: "bg-amber-50 text-amber-600" },
];

const MOBILE_TABS = [
  { icon: Home, label: "Home", active: true },
  { icon: CalendarDays, label: "Agenda" },
  { icon: BookOpen, label: "Lessen" },
  { icon: MessageSquare, label: "Berichten" },
  { icon: User, label: "Profiel" },
];

const PILLS: Record<string, string> = {
  green: "bg-[#e8f0d0] text-[#5a7a1c]",
  blue: "bg-blue-100 text-blue-700",
  gray: "bg-slate-100 text-slate-600",
};

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
          className={(mobile ? "h-14 w-14 text-lg" : "h-14 w-14 text-lg lg:h-20 lg:w-20 lg:text-2xl") + " flex items-center justify-center rounded-2xl font-bold shadow-sm"}
          style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
        >
          ZH
        </div>
        <div className="text-center">
          <div className="text-sm font-bold leading-tight lg:text-base" style={{ color: COLORS.ink }}>Zwemschool Houtrust</div>
          <div className="text-[11px] mt-0.5 lg:text-xs" style={{ color: COLORS.inkLight }}>Trainer omgeving</div>
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
                  <div className="absolute left-0 top-1/2 h-7 w-[4px] -translate-y-1/2 rounded-r-full" style={{ backgroundColor: COLORS.accent }} />
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

function DateNavigator() {
  return (
    <div
      className="hidden items-center gap-2 rounded-full border bg-white px-2 py-1.5 lg:inline-flex"
      style={{ borderColor: COLORS.mint }}
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: COLORS.mint, color: COLORS.accent }}>
        <Calendar className="h-3.5 w-3.5" />
      </div>
      <span className="px-1 text-xs font-semibold" style={{ color: COLORS.ink }}>Maandag 12 mei 2026</span>
      <button className="flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover:bg-black/5" style={{ borderColor: COLORS.mint, color: COLORS.inkLight }} aria-label="Vorige dag">
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button className="flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover:bg-black/5" style={{ borderColor: COLORS.mint, color: COLORS.inkLight }} aria-label="Volgende dag">
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
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
        <DateNavigator />
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

const cardStyle: React.CSSProperties = {
  backgroundColor: COLORS.surface,
  border: `1px solid ${COLORS.cardBorder}`,
};

export default function DashboardV2() {
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
          {/* Greeting + mobile date navigator */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: COLORS.mint, color: COLORS.accent }}
              >
                <Sunrise className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-bold leading-tight tracking-tight" style={{ color: COLORS.ink }}>
                  Goedemorgen, Sophie!
                </h1>
                <p className="mt-0.5 text-sm" style={{ color: COLORS.inkLight }}>
                  Hier is jouw overzicht van vandaag
                </p>
              </div>
            </div>
            <div className="lg:hidden">
              <div
                className="inline-flex items-center gap-2 rounded-full border bg-white px-2 py-1.5"
                style={{ borderColor: COLORS.mint }}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: COLORS.mint, color: COLORS.accent }}>
                  <Calendar className="h-3 w-3" />
                </div>
                <span className="px-1 text-xs font-semibold" style={{ color: COLORS.ink }}>Ma 12 mei 2026</span>
                <button className="flex h-6 w-6 items-center justify-center rounded-full border" style={{ borderColor: COLORS.mint, color: COLORS.inkLight }} aria-label="Vorige dag">
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button className="flex h-6 w-6 items-center justify-center rounded-full border" style={{ borderColor: COLORS.mint, color: COLORS.inkLight }} aria-label="Volgende dag">
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Main 3-column row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:[grid-auto-rows:380px]">
            {/* Agenda */}
            <Card className="flex h-full flex-col rounded-2xl border-0 shadow-sm lg:overflow-hidden" style={cardStyle}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Agenda vandaag</h3>
                <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk volledige agenda →</a>
              </div>
              <CardContent className="flex flex-1 flex-col p-0 lg:overflow-hidden">
                <ScrollArea className="h-full px-3 pb-4">
                  <div className="flex flex-col gap-1">
                    {SESSIONS.map((s, i) => (
                      <div
                        key={i}
                        className="relative rounded-lg px-3 py-2"
                        style={{ backgroundColor: s.active ? COLORS.activeBg : "transparent" }}
                      >
                        {s.active && (
                          <div className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full" style={{ backgroundColor: COLORS.accent }} />
                        )}
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold" style={{ color: COLORS.inkLight }}>{s.time}</div>
                            <div className="mt-0.5 truncate text-sm font-semibold" style={{ color: COLORS.ink }}>{s.title}</div>
                            {s.sub && <div className="truncate text-xs" style={{ color: COLORS.inkLight }}>{s.sub}</div>}
                            <div className="mt-1 text-[11px]" style={{ color: COLORS.inkLight }}>
                              {s.attend} · {s.pool}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${PILLS[s.pill]}`}>
                              {s.status}
                            </span>
                            <ChevronDown className="h-3.5 w-3.5" style={{ color: COLORS.inkLight }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Berichten */}
            <Card className="flex h-full flex-col rounded-2xl border-0 shadow-sm lg:overflow-hidden" style={cardStyle}>
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

            {/* Nieuws */}
            <Card className="flex h-full flex-col rounded-2xl border-0 shadow-sm lg:overflow-hidden" style={cardStyle}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Nieuws</h3>
                <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk alles →</a>
              </div>
              <CardContent className="flex flex-1 flex-col gap-3 p-5 pt-0 lg:overflow-hidden">
                <div className="relative h-32 w-full overflow-hidden rounded-xl bg-gradient-to-br from-cyan-300 to-blue-500">
                  <span
                    className="absolute left-3 top-3 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
                  >
                    NIEUW
                  </span>
                  <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5">
                    <span className="h-1.5 w-4 rounded-full bg-white" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold leading-snug" style={{ color: COLORS.ink }}>
                    Zomerrooster gaat volgende week in
                  </div>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: COLORS.inkLight }}>
                    Vanaf maandag 19 mei starten we met het zomerrooster. Bekijk de aangepaste lestijden.
                  </p>
                  <div className="mt-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                    09 mei 2025
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom 3-column row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Interne berichten */}
            <Card className="rounded-2xl border-0 shadow-sm" style={cardStyle}>
              <div className="flex items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Interne berichten</h3>
                <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk alles →</a>
              </div>
              <CardContent className="flex flex-col gap-2.5 p-5 pt-0">
                {INTERNAL.map((n, i) => {
                  const Icon = n.icon;
                  return (
                    <div key={i} className={`rounded-lg border p-3 ${n.bg}`}>
                      <div className="flex items-start gap-2.5">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.chip}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>{n.title}</div>
                            <div className="shrink-0 text-[10px] font-medium uppercase tracking-wider" style={{ color: COLORS.inkLight }}>{n.date}</div>
                          </div>
                          <div className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.inkLight }}>{n.text}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Snel acties */}
            <Card className="rounded-2xl border-0 shadow-sm" style={cardStyle}>
              <div className="p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Snel acties</h3>
              </div>
              <CardContent className="flex flex-col gap-2 p-5 pt-0">
                {QUICK_ACTIONS.map((a) => {
                  const Icon = a.icon;
                  const isMint = !a.bg;
                  return (
                    <button
                      key={a.label}
                      className="flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:shadow-sm"
                      style={{ borderColor: COLORS.cardBorder }}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.bg} ${a.color}`}
                        style={isMint ? { backgroundColor: COLORS.mint, color: COLORS.accent } : undefined}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>{a.label}</div>
                        <div className="text-[11px]" style={{ color: COLORS.inkLight }}>{a.sub}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: COLORS.inkLight }} />
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Jouw overzicht */}
            <Card className="rounded-2xl border-0 shadow-sm" style={cardStyle}>
              <div className="p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Jouw overzicht</h3>
              </div>
              <CardContent className="flex flex-col gap-1 p-5 pt-0">
                {OVERVIEW.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.chipClass ?? ""}`}
                        style={s.chipClass ? undefined : { backgroundColor: s.chipBg, color: s.chipColor }}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1 text-sm font-medium" style={{ color: COLORS.ink }}>{s.label}</div>
                      <div className="text-2xl font-bold leading-none" style={{ color: COLORS.ink }}>{s.value}</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Footer Top!-bar */}
          <div
            className="flex flex-col gap-4 rounded-2xl p-5 text-white lg:flex-row lg:items-center"
            style={{ backgroundColor: COLORS.ink }}
          >
            <div className="flex flex-1 items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "rgba(182,216,59,0.18)", color: COLORS.accent }}
              >
                <Star className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold">Top!</div>
                <p className="text-sm text-white/80">Deze week al 85% van je lessen gegeven. Keep it up!</p>
              </div>
            </div>
            <div className="flex items-center gap-4 lg:w-2/5">
              <div className="text-2xl font-bold" style={{ color: COLORS.accent }}>85%</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: "85%", backgroundColor: COLORS.accent }} />
              </div>
            </div>
          </div>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
