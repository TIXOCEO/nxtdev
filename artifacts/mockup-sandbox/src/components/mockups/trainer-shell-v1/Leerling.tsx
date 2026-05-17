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
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  FileEdit,
  Menu,
  User,
  X,
  Eye,
  Award,
  Cake,
  Phone,
  Mail,
  Clock,
  Calendar,
  Star,
  Droplet,
  MapPin,
  Check,
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
  { icon: Home, label: "Dashboard" },
  { icon: CalendarDays, label: "Agenda" },
  { icon: BookOpen, label: "Mijn lessen" },
  { icon: Users, label: "Leerlingen", active: true },
  { icon: MessageSquare, label: "Berichten", badge: "5" },
  { icon: Users2, label: "Groepen" },
  { icon: CheckSquare, label: "Taken", badge: "2" },
  { icon: FileText, label: "Documenten" },
  { icon: Library, label: "Handleidingen" },
];

const MOBILE_TABS = [
  { icon: Home, label: "Home" },
  { icon: CalendarDays, label: "Agenda" },
  { icon: BookOpen, label: "Lessen" },
  { icon: MessageSquare, label: "Berichten" },
  { icon: User, label: "Profiel" },
];

const INFO_CHIPS = [
  { icon: Cake, label: "Geboortedatum", value: "14 apr 2016 (9 jaar)" },
  { icon: User, label: "Ouder / verzorger", value: "Lisa de Jong" },
  { icon: Phone, label: "Telefoon", value: "06 12345678" },
  { icon: Mail, label: "E-mail", value: "lisa.dejong@email.nl" },
];

const ACTIONS = [
  { icon: Eye, label: "Observatie toevoegen", chipClass: "bg-blue-50 text-blue-600" },
  { icon: AlertCircle, label: "Absentie melden", chipClass: "bg-red-50 text-red-600" },
  { icon: MessageSquare, label: "Bericht sturen", chipClass: "bg-purple-50 text-purple-600" },
  { icon: FileEdit, label: "Les notitie", chipClass: "bg-amber-50 text-amber-600" },
  { icon: Award, label: "Diploma's", chipClass: "bg-green-50 text-green-600" },
  { icon: FileText, label: "Documenten", chipClass: "bg-emerald-50 text-emerald-700" },
];

const KEY_FACTS = [
  { icon: Home, label: "Groep & niveau", value: "Badje 2 — De schildpad", chipClass: "bg-emerald-50 text-emerald-700" },
  { icon: User, label: "Instructeur", value: "Sophie Jansen", chipClass: "bg-blue-50 text-blue-600" },
  { icon: Clock, label: "Lesmomenten", value: "Ma 16:00 · Wo 16:00", chipClass: "bg-amber-50 text-amber-600" },
  { icon: Calendar, label: "Lid sinds", value: "12 mrt 2024", chipClass: "bg-purple-50 text-purple-600" },
];

const SKILLS = [
  { name: "Drijven op rug", status: "Beheerst", color: "green" },
  { name: "Kicken aan de kant", status: "Beheerst", color: "green" },
  { name: "Springen in het water", status: "Oefenen", color: "amber" },
  { name: "Uitglijden op de buik", status: "Oefenen", color: "amber" },
  { name: "Onderwater oriëntatie", status: "Nog niet geoefend", color: "slate" },
];

const OBSERVATIONS = [
  { icon: CheckCircle, chipClass: "bg-green-50 text-green-600", title: "Goed gewerkt vandaag!", text: "Emma durfde vandaag voor het eerst zelfstandig te springen. Super trots!", meta: "Sophie Jansen · 08 mei 2025" },
  { icon: AlertCircle, chipClass: "bg-amber-50 text-amber-600", title: "Let op houding bij drijven", text: "Probeer armen iets verder uit elkaar te houden voor meer stabiliteit.", meta: "Sophie Jansen · 01 mei 2025" },
  { icon: Info, chipClass: "bg-blue-50 text-blue-600", title: "Fijne les!", text: "Emma was vandaag erg geconcentreerd en deed actief mee met alle oefeningen.", meta: "Sophie Jansen · 24 apr 2025" },
];

const ATTENDANCE_DOTS: { color: "green" | "amber" | "red"; date: string }[] = [
  { color: "green", date: "24/4" },
  { color: "green", date: "26/4" },
  { color: "green", date: "1/5" },
  { color: "green", date: "3/5" },
  { color: "green", date: "8/5" },
  { color: "green", date: "10/5" },
  { color: "amber", date: "15/5" },
  { color: "green", date: "17/5" },
  { color: "green", date: "22/5" },
  { color: "red", date: "24/5" },
];

const REWARDS = [
  { icon: Award, chipClass: "bg-green-100 text-green-700", title: "Moedige springer", text: "Voor het eerst zelfstandig gesprongen", date: "08 mei 2025" },
  { icon: Star, chipClass: "bg-purple-100 text-purple-700", title: "Doorzetter", text: "3 lessen achter elkaar actief meegedaan", date: "24 apr 2025" },
  { icon: Droplet, chipClass: "bg-blue-100 text-blue-700", title: "Waterrat", text: "10 keer geoefend met drijven", date: "10 apr 2025" },
];

const LESSON_INFO = [
  { icon: Calendar, label: "Eerstvolgende les", value: "Vandaag, 12 mei 2025 · 16:00 – 16:45" },
  { icon: MapPin, label: "Locatie", value: "Zwembad De Watertuin · Badje 2" },
  { icon: Clock, label: "Lesduur", value: "45 minuten" },
  { icon: Users, label: "Groepsgrootte", value: "10 leerlingen" },
];

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: COLORS.surface,
  border: "1px solid rgba(15,30,58,0.08)",
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
        <span>Leerlingen</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        <span className="font-bold" style={{ color: COLORS.ink }}>Emma de Jong</span>
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
            <Icon className="h-5 w-5" style={{ color: COLORS.inkLight }} />
            <span className="text-[10px] font-medium" style={{ color: COLORS.inkLight }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function Donut({ size, pct, color, label }: { size: number; pct: number; color: string; label?: string }) {
  const stroke = size <= 70 ? 7 : 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={center} cy={center} r={r} fill="none" stroke={COLORS.mint} strokeWidth={stroke} />
      <circle
        cx={center} cy={center} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text x={center} y={center - 1} textAnchor="middle" className="font-bold" fontSize={size <= 70 ? 13 : 22} fill={COLORS.ink}>
        {pct}%
      </text>
      {label && (
        <text x={center} y={center + (size <= 70 ? 12 : 18)} textAnchor="middle" fontSize={size <= 70 ? 8 : 10} fill={COLORS.inkLight}>
          {label}
        </text>
      )}
    </svg>
  );
}

function SkillPill({ status, color }: { status: string; color: string }) {
  const map: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", dot: "bg-green-500" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
    slate: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600", dot: "bg-slate-400" },
  };
  const c = map[color];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${c.bg} ${c.border} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}

function AttendanceDot({ color }: { color: "green" | "amber" | "red" }) {
  const map = {
    green: { bg: "bg-green-500", Icon: Check },
    amber: { bg: "bg-amber-500", Icon: AlertCircle },
    red: { bg: "bg-red-500", Icon: X },
  } as const;
  const { bg, Icon } = map[color];
  return (
    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${bg}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={3} />
    </div>
  );
}

export default function Leerling() {
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

      <main className="flex min-w-0 flex-1 flex-col pb-24 pt-[54px] lg:pb-0 lg:pt-0">
        <TopBar />

        <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
          {/* Sub-breadcrumb */}
          <div className="hidden items-center gap-1 text-sm lg:flex" style={{ color: COLORS.inkLight }}>
            <ChevronLeft className="h-4 w-4" />
            <span>Leerlingen</span>
            <span className="opacity-50">/</span>
            <span className="font-bold" style={{ color: COLORS.ink }}>Emma de Jong</span>
          </div>

          {/* Top hoofdcard */}
          <Card className="border-none shadow-sm rounded-2xl" style={CARD_STYLE}>
            <CardContent className="p-4 lg:p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Avatar */}
                <div className="flex justify-center lg:col-span-3 lg:justify-start">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-pink-200 to-orange-200 text-4xl font-bold text-white shadow-inner">
                    E
                  </div>
                </div>

                {/* Naam + info */}
                <div className="lg:col-span-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold lg:text-3xl" style={{ color: COLORS.ink }}><span className="inline-block h-7 w-1 rounded-full mr-3 align-middle" style={{ backgroundColor: "#1e3a5f" }} />Emma de Jong</h1>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: COLORS.mint, color: "#4a6b14" }}>
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Actief
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {INFO_CHIPS.map((c) => {
                      const Icon = c.icon;
                      return (
                        <div key={c.label} className="flex items-start gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: COLORS.mint, color: COLORS.accent }}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: COLORS.inkLight }}>{c.label}</div>
                            <div className="mt-0.5 truncate text-sm font-semibold" style={{ color: COLORS.ink }}>{c.value}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Acties */}
                <div className="lg:col-span-3">
                  <h3 className="mb-3 text-sm font-bold" style={{ color: COLORS.ink }}>Acties</h3>
                  <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
                    {ACTIONS.map((a) => {
                      const Icon = a.icon;
                      return (
                        <button
                          key={a.label}
                          className="flex flex-col items-start gap-2 rounded-xl border p-2.5 text-left transition-all hover:shadow-sm"
                          style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface }}
                        >
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.chipClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="text-[11px] font-semibold leading-tight" style={{ color: COLORS.ink }}>{a.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key fact tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {KEY_FACTS.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.label} className="border-none shadow-sm rounded-2xl" style={CARD_STYLE}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${f.chipClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: COLORS.inkLight }}>{f.label}</div>
                      <div className="mt-0.5 truncate text-sm font-bold" style={{ color: COLORS.ink }}>{f.value}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Main 2-col grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left col */}
            <div className="flex flex-col gap-6 lg:col-span-7">
              {/* Voortgang */}
              <Card className="border-none shadow-sm rounded-2xl" style={CARD_STYLE}>
                <CardContent className="p-4 lg:p-6">
                  <h3 className="font-bold" style={{ color: COLORS.ink }}>Voortgang overzicht</h3>
                  <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                    <div className="relative">
                      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
                        <circle cx="70" cy="70" r="58" fill="none" stroke={COLORS.mint} strokeWidth="14" />
                        <circle cx="70" cy="70" r="58" fill="none" stroke={COLORS.accent} strokeWidth="14" strokeLinecap="round"
                          strokeDasharray={`${(62 / 100) * (2 * Math.PI * 58)} ${2 * Math.PI * 58}`}
                          transform="rotate(-90 70 70)" />
                        <text x="70" y="68" textAnchor="middle" fontSize="26" fontWeight="bold" fill={COLORS.ink}>62%</text>
                        <text x="70" y="86" textAnchor="middle" fontSize="11" fill={COLORS.inkLight}>Voortgang</text>
                      </svg>
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.inkLight }}>Op weg naar</div>
                      <div className="mt-0.5 text-lg font-bold" style={{ color: COLORS.ink }}>Zwemdiploma A</div>
                      <p className="mt-1.5 text-sm" style={{ color: COLORS.inkLight }}>
                        Emma is goed op weg! Blijf oefenen op de volgende vaardigheden.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-3 h-9 rounded-full border-2 text-xs font-semibold"
                        style={{ borderColor: COLORS.accent, color: COLORS.ink, backgroundColor: "transparent" }}
                      >
                        Bekijk detailoverzicht →
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>Laatste vaardigheden</div>
                    <div className="mt-3 flex flex-col gap-2">
                      {SKILLS.map((s) => (
                        <div key={s.name} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ backgroundColor: COLORS.mainBg }}>
                          <div className="text-sm font-medium" style={{ color: COLORS.ink }}>{s.name}</div>
                          <SkillPill status={s.status} color={s.color} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-right">
                      <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk alle vaardigheden →</a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Observaties */}
              <Card className="border-none shadow-sm rounded-2xl" style={CARD_STYLE}>
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold" style={{ color: COLORS.ink }}>Laatste observaties</h3>
                    <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk alles →</a>
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    {OBSERVATIONS.map((o, i) => {
                      const Icon = o.icon;
                      return (
                        <div key={i} className="flex items-start gap-3 rounded-xl p-3" style={{ backgroundColor: COLORS.mainBg }}>
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${o.chipClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>{o.title}</div>
                            <div className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.inkLight }}>{o.text}</div>
                            <div className="mt-1.5 text-[11px] font-medium" style={{ color: COLORS.inkLight }}>{o.meta}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-semibold transition-colors"
                    style={{ borderColor: COLORS.border, color: COLORS.inkLight }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    + Nieuwe observatie toevoegen
                  </button>
                </CardContent>
              </Card>
            </div>

            {/* Right col */}
            <div className="flex flex-col gap-6 lg:col-span-5">
              {/* Aanwezigheid */}
              <Card className="border-none shadow-sm rounded-2xl" style={CARD_STYLE}>
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold" style={{ color: COLORS.ink }}>Aanwezigheid</h3>
                    <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk alles →</a>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { pct: 92, color: "#22c55e", label: "Aanwezig" },
                      { pct: 5, color: "#ef4444", label: "Absent" },
                      { pct: 3, color: "#f59e0b", label: "Te laat" },
                    ].map((d) => (
                      <div key={d.label} className="flex flex-col items-center gap-1.5">
                        <Donut size={64} pct={d.pct} color={d.color} />
                        <div className="text-[11px] font-medium" style={{ color: COLORS.inkLight }}>{d.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>Laatste 10 lessen</div>
                    <ScrollArea className="mt-3">
                      <div className="flex items-center gap-2 pb-2">
                        {ATTENDANCE_DOTS.map((d, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <AttendanceDot color={d.color} />
                            <span className="text-[10px]" style={{ color: COLORS.inkLight }}>{d.date}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              {/* Beloningen */}
              <Card className="border-none shadow-sm rounded-2xl" style={CARD_STYLE}>
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold" style={{ color: COLORS.ink }}>Beloningen & mijlpalen</h3>
                    <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk alles →</a>
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    {REWARDS.map((r, i) => {
                      const Icon = r.icon;
                      return (
                        <div key={i} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: COLORS.border }}>
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${r.chipClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold" style={{ color: COLORS.ink }}>{r.title}</div>
                            <div className="mt-0.5 text-xs" style={{ color: COLORS.inkLight }}>{r.text}</div>
                            <div className="mt-1 text-[11px] font-medium" style={{ color: COLORS.inkLight }}>{r.date}</div>
                          </div>
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Lesinformatie */}
            <Card className="border-none shadow-sm rounded-2xl" style={CARD_STYLE}>
              <CardContent className="p-4 lg:p-6">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Lesinformatie</h3>
                <div className="mt-4 flex flex-col gap-3">
                  {LESSON_INFO.map((l) => {
                    const Icon = l.icon;
                    return (
                      <div key={l.label} className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: COLORS.mint, color: COLORS.accent }}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: COLORS.inkLight }}>{l.label}</div>
                          <div className="mt-0.5 text-sm font-semibold" style={{ color: COLORS.ink }}>{l.value}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Tegoeden */}
            <Card className="border-none shadow-sm rounded-2xl" style={CARD_STYLE}>
              <CardContent className="p-4 lg:p-6">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Tegoeden & lessen</h3>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { value: "1", label: "tegoed", caption: "Inhaallessen", bg: "bg-green-50", text: "text-green-700" },
                    { value: "0", label: "openstaand", caption: "Openstaande lessen", bg: "bg-slate-100", text: "text-slate-600" },
                    { value: "1", label: "afgezegd", caption: "Afgezegde lessen", bg: "bg-red-50", text: "text-red-600" },
                  ].map((t) => (
                    <div key={t.caption} className="flex flex-col items-center text-center">
                      <div className={`flex w-full flex-col items-center rounded-xl px-2 py-3 ${t.bg} ${t.text}`}>
                        <div className="text-2xl font-bold leading-none">{t.value}</div>
                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider">{t.label}</div>
                      </div>
                      <div className="mt-2 text-[11px]" style={{ color: COLORS.inkLight }}>{t.caption}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-right">
                  <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Inhaalmoment plannen →</a>
                </div>
              </CardContent>
            </Card>

            {/* Notities */}
            <Card className="border-none shadow-sm rounded-2xl" style={CARD_STYLE}>
              <CardContent className="p-4 lg:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold" style={{ color: COLORS.ink }}>Notities</h3>
                  <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accent }}>Bekijk alles →</a>
                </div>
                <div className="mt-4 rounded-xl border bg-amber-50 p-3" style={{ borderColor: "#fde68a" }}>
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold" style={{ color: COLORS.ink }}>Allergie voor chloor</div>
                      <div className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.inkLight }}>
                        Huid reageert gevoelig. Houd hier rekening mee.
                      </div>
                      <div className="mt-2 text-[10px] font-medium" style={{ color: COLORS.inkLight }}>
                        Toegevoegd door Lisa de Jong · 12 mrt 2024
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-semibold transition-colors"
                  style={{ borderColor: COLORS.border, color: COLORS.inkLight }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.hoverBg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  + Notitie toevoegen
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
