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
  Menu,
  User,
  X,
  Plus,
  Waves,
  Fish,
  Bird,
  Sparkles,
  Crown,
} from "lucide-react";
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

const CARD_BORDER = "1px solid rgba(15,30,58,0.08)";

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
  { icon: Users, label: "Leerlingen" },
  { icon: MessageSquare, label: "Berichten", badge: "5" },
  { icon: Users2, label: "Groepen", active: true },
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

const TABS = [
  { label: "Actieve groepen", active: true },
  { label: "Inactieve groepen" },
];

type Group = {
  name: string;
  sub: string;
  schedule: string;
  count: string;
  progress: number;
  progressTone: "green" | "amber";
  icon: React.ElementType;
  gradient: string;
};

const GROUPS: Group[] = [
  { name: "Badje 1", sub: "De zeester", schedule: "Maandag 09:30 · Zwembad De Watertuin", count: "12 leerlingen", progress: 78, progressTone: "green", icon: Waves, gradient: "from-cyan-400 to-blue-500" },
  { name: "Badje 2", sub: "De schildpad", schedule: "Maandag 09:30 · Zwembad De Watertuin", count: "10 leerlingen", progress: 65, progressTone: "green", icon: Fish, gradient: "from-green-400 to-emerald-500" },
  { name: "Badje 3", sub: "De dolfijn", schedule: "Maandag 09:30 · Zwembad De Watertuin", count: "11 leerlingen", progress: 62, progressTone: "amber", icon: Bird, gradient: "from-purple-400 to-pink-500" },
  { name: "Privéles", sub: "Lisa de Jong", schedule: "Maandag 09:30 · Zwembad De Watertuin", count: "1 leerling", progress: 80, progressTone: "green", icon: Sparkles, gradient: "from-orange-400 to-amber-500" },
  { name: "Badje 4", sub: "De krokodil", schedule: "Maandag 09:30 · Zwembad De Watertuin", count: "9 leerlingen", progress: 45, progressTone: "amber", icon: Crown, gradient: "from-teal-400 to-cyan-500" },
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
        <span className="font-bold" style={{ color: COLORS.ink }}>Groepen</span>
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

function Donut({ value, tone }: { value: number; tone: "green" | "amber" }) {
  const stroke = tone === "green" ? "#16a34a" : "#f59e0b";
  const r = 24;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} stroke="#e5eada" strokeWidth="5" fill="none" />
        <circle
          cx="28"
          cy="28"
          r={r}
          stroke={stroke}
          strokeWidth="5"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
        style={{ color: COLORS.ink }}
      >
        {value}%
      </div>
    </div>
  );
}

function GroupCard({ group }: { group: Group }) {
  const Icon = group.icon;
  return (
    <div
      className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:gap-4 sm:p-5"
      style={{ border: CARD_BORDER }}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${group.gradient} text-white shadow-sm sm:h-14 sm:w-14`}
      >
        <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold sm:text-base" style={{ color: COLORS.ink }}>
          {group.name} <span className="font-medium" style={{ color: COLORS.inkLight }}>— {group.sub}</span>
        </div>
        <div className="mt-0.5 truncate text-xs" style={{ color: COLORS.inkLight }}>
          {group.schedule}
        </div>
      </div>
      <div className="hidden text-right text-xs font-medium sm:block" style={{ color: COLORS.inkLight }}>
        {group.count}
      </div>
      <Donut value={group.progress} tone={group.progressTone} />
      <ChevronRight className="hidden h-5 w-5 shrink-0 sm:block" style={{ color: COLORS.inkLight }} />
    </div>
  );
}

export default function Groepen() {
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.ink }}>Groepen</h1>
              <p className="mt-1 text-sm" style={{ color: COLORS.inkLight }}>
                Overzicht van al jouw groepen
              </p>
            </div>
            <Button
              className="shrink-0 font-semibold shadow-sm"
              style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nieuwe groep
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((t) => (
              <button
                key={t.label}
                className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: t.active ? COLORS.ink : "transparent",
                  color: t.active ? "#fff" : COLORS.inkLight,
                  border: t.active ? "none" : `1px solid ${COLORS.border}`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            {GROUPS.map((g) => (
              <GroupCard key={g.name + g.sub} group={g} />
            ))}
          </div>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
