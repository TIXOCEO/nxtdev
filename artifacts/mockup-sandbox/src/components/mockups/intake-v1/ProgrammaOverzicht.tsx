import React from "react";
import {
  Home,
  Layers,
  ClipboardList,
  Inbox,
  MessageSquare,
  BarChart3,
  Settings,
  Bell,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = {
  accent: "#b6d83b",
  ink: "#0f1e3a",
  inkLight: "#5b6a83",
  sidebarBg: "#f4f8eb",
  mainBg: "#fbfcf9",
  surface: "#ffffff",
  border: "#e5eada",
  activeBg: "#e5edf7",
  hoverBg: "#eef2f8",
  mint: "#eef5d8",
};

const NAV_ITEMS = [
  { icon: Home, label: "Home" },
  { icon: Layers, label: "Programma's", active: true },
  { icon: ClipboardList, label: "Aanmeldingen" },
  { icon: Inbox, label: "Intakes" },
  { icon: MessageSquare, label: "Berichten" },
  { icon: BarChart3, label: "Rapportages" },
  { icon: Settings, label: "Instellingen" },
];

type Pill = { label: string; bg: string; color: string; dotColor: string };

const PILL_SHORT: Pill = { label: "Korte wachtrij", bg: "#dcfce7", color: "#15803d", dotColor: "#22c55e" };
const PILL_MED: Pill = { label: "Gemiddelde wachtrij", bg: "#fef3c7", color: "#b45309", dotColor: "#f59e0b" };
const PILL_LONG: Pill = { label: "Lange wachtrij", bg: "#fee2e2", color: "#b91c1c", dotColor: "#ef4444" };

interface Program {
  letter: string;
  name: string;
  age: string;
  gradient: string;
  pill: Pill;
  wait: string;
  dots: ("free" | "few" | "full" | "none")[];
}

const PROGRAMS: Program[] = [
  {
    letter: "A",
    name: "Zwemdiploma A",
    age: "Vanaf ± 5 jaar",
    gradient: "linear-gradient(135deg, #22d3ee, #2563eb)",
    pill: PILL_SHORT,
    wait: "± 2 weken",
    dots: ["free", "free", "few", "free"],
  },
  {
    letter: "B",
    name: "Zwemdiploma B",
    age: "Vanaf ± 6 jaar",
    gradient: "linear-gradient(135deg, #34d399, #059669)",
    pill: PILL_MED,
    wait: "± 6 weken",
    dots: ["few", "few", "full", "few"],
  },
  {
    letter: "C",
    name: "Zwemdiploma C",
    age: "Vanaf ± 7 jaar",
    gradient: "linear-gradient(135deg, #c084fc, #ec4899)",
    pill: PILL_LONG,
    wait: "± 10 weken",
    dots: ["full", "full", "none", "full"],
  },
  {
    letter: "P",
    name: "Proefles",
    age: "Vanaf ± 4 jaar",
    gradient: "linear-gradient(135deg, #fbbf24, #f97316)",
    pill: PILL_SHORT,
    wait: "± 1 week",
    dots: ["free", "free", "free", "few"],
  },
];

const DOT_COLORS: Record<string, string> = {
  free: "#22c55e",
  few: "#f59e0b",
  full: "#ef4444",
  none: "#cbd5e1",
};

function Sidebar() {
  return (
    <aside
      className="hidden shrink-0 flex-col lg:flex lg:w-[260px]"
      style={{
        backgroundColor: COLORS.sidebarBg,
        borderRight: `1px solid ${COLORS.border}`,
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div className="flex flex-col items-center gap-3 px-4 pt-10 pb-6">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold shadow-sm lg:h-20 lg:w-20 lg:text-2xl"
          style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
        >
          ZD
        </div>
        <div className="text-center">
          <div className="text-base font-bold leading-tight" style={{ color: COLORS.ink }}>
            Zwemschool Demo
          </div>
          <div className="mt-0.5 text-xs" style={{ color: COLORS.inkLight }}>
            Tenant-admin
          </div>
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
              >
                {item.active && (
                  <div
                    className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
                    style={{ backgroundColor: COLORS.accent }}
                  />
                )}
                <Icon
                  className="h-4 w-4 shrink-0"
                  style={{ color: item.active ? "#1e3a5f" : "currentColor" }}
                />
                <span className="flex-1 truncate text-left">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="mt-auto px-3 py-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]"
          style={{ color: COLORS.inkLight }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: COLORS.accent }} />
          <span>
            Powered by <span className="font-bold" style={{ color: COLORS.accent }}>NXTTRACK</span>
          </span>
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header
      className="flex h-16 shrink-0 items-center justify-between border-b px-8"
      style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
    >
      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: COLORS.inkLight }}>
        <span>Zwemschool Demo</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        <span className="font-bold" style={{ color: COLORS.ink }}>
          Programma's
        </span>
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
            AD
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>
              Admin Demo
            </div>
            <div className="text-[11px]" style={{ color: COLORS.inkLight }}>
              Tenant-admin
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function ProgramCard({ p }: { p: Program }) {
  return (
    <button
      className="flex w-full items-center gap-6 rounded-2xl bg-white p-5 text-left shadow-sm transition-all hover:shadow-md"
      style={{ border: `1px solid ${COLORS.border}` }}
    >
      {/* Letter logo */}
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow-sm"
        style={{ background: p.gradient }}
      >
        {p.letter}
      </div>

      {/* Name + age */}
      <div className="w-[220px] shrink-0">
        <div className="text-base font-bold" style={{ color: COLORS.ink }}>
          {p.name}
        </div>
        <div className="mt-0.5 text-xs" style={{ color: COLORS.inkLight }}>
          {p.age}
        </div>
      </div>

      {/* Wachtrij pill */}
      <div className="w-[200px] shrink-0">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: p.pill.bg, color: p.pill.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.pill.dotColor }} />
          {p.pill.label}
        </span>
      </div>

      {/* Wachttijd */}
      <div className="w-[140px] shrink-0">
        <div className="text-base font-bold" style={{ color: COLORS.ink }}>
          {p.wait}
        </div>
        <div className="mt-0.5 text-[11px] uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
          Gem. wachttijd
        </div>
      </div>

      {/* Beschikbaarheid */}
      <div className="flex-1">
        <div
          className="mb-1.5 text-[11px] uppercase tracking-wider"
          style={{ color: COLORS.inkLight }}
        >
          Beschikbaarheid Komende weken
        </div>
        <div className="flex items-center gap-2">
          {p.dots.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: DOT_COLORS[d] }}
              />
              <span className="text-[10px]" style={{ color: COLORS.inkLight }}>
                w{i + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0" style={{ color: COLORS.inkLight }} />
    </button>
  );
}

export default function ProgrammaOverzicht() {
  return (
    <div className="flex min-h-[100dvh] w-full font-sans" style={{ backgroundColor: COLORS.mainBg }}>
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <div className="flex flex-col gap-6 p-8">
          {/* Header */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.ink }}>
                <span className="inline-block h-7 w-1 rounded-full mr-3 align-middle" style={{ backgroundColor: "#1e3a5f" }} />
                Programma-overzicht
              </h1>
              <p className="mt-1 text-sm" style={{ color: COLORS.inkLight }}>
                Bekijk alle zwemprogramma's en de actuele wachtrijdruk
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold shadow-sm"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
              >
                <span>Alle programma's</span>
                <ChevronDown className="h-4 w-4" style={{ color: COLORS.inkLight }} />
              </button>
              <button
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold shadow-sm"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
              >
                <SlidersHorizontal className="h-4 w-4" style={{ color: COLORS.inkLight }} />
                <span>Filter</span>
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-3">
            {PROGRAMS.map((p) => (
              <ProgramCard key={p.letter + p.name} p={p} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
