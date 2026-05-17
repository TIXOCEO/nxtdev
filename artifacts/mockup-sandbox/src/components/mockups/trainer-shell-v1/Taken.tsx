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
  Square,
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
  { icon: Users2, label: "Groepen" },
  { icon: CheckSquare, label: "Taken", badge: "2", active: true },
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

const STATS = [
  { value: "2", label: "Te doen", color: "text-amber-600" },
  { value: "3", label: "Bezig", color: "text-blue-600" },
  { value: "5", label: "Voltooid", color: "text-green-600" },
  { value: "1", label: "Overtijd", color: "text-red-600" },
];

type TaskPill = { text: string; tone: "amber" | "red" };
type Task = { title: string; body: string; pill: TaskPill; avatar: string };

const TODO_TASKS: Task[] = [
  { title: "Absenties controleren", body: "Controleer de absenties van vandaag", pill: { text: "Vandaag", tone: "amber" }, avatar: "SJ" },
  { title: "Lesmateriaal klaarzetten — Badje 1", body: "Zwemmaterialen voor de les van 16:00", pill: { text: "Vandaag", tone: "amber" }, avatar: "SJ" },
  { title: "Voortgangsregistratie bijwerken", body: "Werk de voortgang bij van je leerlingen", pill: { text: "Vandaag", tone: "amber" }, avatar: "SJ" },
  { title: "Oudercommunicatie", body: "Stuur informatie over zomerrooster", pill: { text: "Morgen", tone: "amber" }, avatar: "SJ" },
];

const OVERDUE_TASKS: Task[] = [
  { title: "Evaluatie midvakantie inleveren", body: "Graag voor 10 mei inleveren", pill: { text: "10 mei", tone: "red" }, avatar: "SJ" },
];

const TABS = [
  { label: "Mijn taken", active: true },
  { label: "Toegewezen door mij" },
  { label: "Voltooid" },
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
        <span className="font-bold" style={{ color: COLORS.ink }}>Taken</span>
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

function TaskRow({ task }: { task: Task }) {
  const pillClass = task.pill.tone === "red"
    ? "bg-red-50 text-red-600"
    : "bg-amber-50 text-amber-700";
  return (
    <div
      className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm sm:p-5"
      style={{ border: CARD_BORDER }}
    >
      <button
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border"
        style={{ borderColor: COLORS.border }}
        aria-label="Markeer als voltooid"
      >
        <Square className="h-3.5 w-3.5" style={{ color: COLORS.inkLight }} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold" style={{ color: COLORS.ink }}>{task.title}</div>
        <div className="mt-0.5 truncate text-xs" style={{ color: COLORS.inkLight }}>{task.body}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold ${pillClass}`}>
          {task.pill.text}
        </span>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: COLORS.ink }}
        >
          {task.avatar}
        </div>
      </div>
    </div>
  );
}

export default function Taken() {
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.ink }}>Taken</h1>
            <p className="mt-1 text-sm" style={{ color: COLORS.inkLight }}>
              Overzicht van jouw taken en acties
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <Button
              className="shrink-0 font-semibold shadow-sm"
              style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nieuwe taak
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"
                style={{ border: CARD_BORDER }}
              >
                <div className={`text-3xl font-bold leading-none ${s.color}`}>{s.value}</div>
                <div className="mt-2 text-xs font-medium" style={{ color: COLORS.inkLight }}>{s.label}</div>
              </div>
            ))}
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
              Te doen
            </h2>
            <div className="flex flex-col gap-2.5">
              {TODO_TASKS.map((t) => (
                <TaskRow key={t.title} task={t} />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-600">
              Overtijd (1)
            </h2>
            <div
              className="flex flex-col gap-2.5 rounded-2xl border border-red-200 bg-red-50/60 p-3 sm:p-4"
            >
              {OVERDUE_TASKS.map((t) => (
                <TaskRow key={t.title} task={t} />
              ))}
            </div>
          </section>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
