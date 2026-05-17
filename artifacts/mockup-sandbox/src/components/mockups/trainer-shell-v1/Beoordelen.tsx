import React from "react";
import {
  Menu,
  Bell,
  Save,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Home,
  CalendarDays,
  BookOpen,
  MessageSquare,
  User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const COLORS = {
  accent: "#b6d83b",
  ink: "#0f1e3a",
  inkLight: "#5b6a83",
  sidebarBg: "#f4f8eb",
  mainBg: "#fbfcf9",
  surface: "#ffffff",
  border: "#e5eada",
  mint: "#eef5d8",
  activeBg: "#e8f0d0",
};

type Level = "none" | "practice" | "almost" | "good" | "mastered";

const LEVELS: { key: Level; label: string; dot: string; text: string; border: string; bg: string; ring: string }[] = [
  { key: "none", label: "Nog niet", dot: "bg-slate-300", text: "text-slate-500", border: "border-slate-200", bg: "bg-white", ring: "ring-slate-200" },
  { key: "practice", label: "Oefenen nodig", dot: "bg-red-500", text: "text-red-600", border: "border-red-500", bg: "bg-red-50", ring: "ring-red-200" },
  { key: "almost", label: "Bijna", dot: "bg-amber-500", text: "text-amber-700", border: "border-amber-500", bg: "bg-amber-50", ring: "ring-amber-200" },
  { key: "good", label: "Goed bezig", dot: "bg-blue-500", text: "text-blue-700", border: "border-blue-500", bg: "bg-blue-50", ring: "ring-blue-200" },
  { key: "mastered", label: "Beheerst", dot: "bg-green-500", text: "text-green-700", border: "border-green-500", bg: "bg-green-50", ring: "ring-green-200" },
];

const ONDERDELEN: { name: string; selected: Level }[] = [
  { name: "Uitlijnen op de buik", selected: "mastered" },
  { name: "Spetteren op de rug", selected: "good" },
  { name: "Kicken aan de kant", selected: "mastered" },
  { name: "Springen in het water", selected: "almost" },
  { name: "Onderwater oriëntatie", selected: "practice" },
  { name: "Crawlslag armen", selected: "good" },
  { name: "Rugslag benen", selected: "almost" },
];

const MOBILE_TABS = [
  { icon: Home, label: "Home" },
  { icon: CalendarDays, label: "Agenda", active: true },
  { icon: BookOpen, label: "Lessen" },
  { icon: MessageSquare, label: "Berichten" },
  { icon: User, label: "Profiel" },
];

function MobileTopBar() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-40 flex h-[54px] items-center justify-between border-b px-4"
      style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
    >
      <button className="p-1" style={{ color: COLORS.ink }}>
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold" style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}>
          NT
        </div>
        <span className="text-sm font-bold" style={{ color: COLORS.ink }}>NxtTrack</span>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative">
          <Bell className="h-5 w-5" style={{ color: COLORS.inkLight }} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: COLORS.ink }}>
          SJ
        </div>
      </div>
    </header>
  );
}

function MobileTabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t"
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

function SelectionPill({ level, selected }: { level: typeof LEVELS[number]; selected: boolean }) {
  if (selected) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 ring-2 ${level.border} ${level.bg} ${level.text} ${level.ring}`}>
        <span className={`h-2 w-2 rounded-full ${level.dot}`} />
        <span className="text-[10px] font-semibold whitespace-nowrap">{level.label}</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-200 bg-white px-2.5 py-1 text-slate-400">
      <span className="h-2 w-2 rounded-full bg-slate-300" />
      <span className="text-[10px] font-semibold whitespace-nowrap">{level.label}</span>
    </div>
  );
}

export default function Beoordelen() {
  const beheerst = 2;
  const total = 8;
  const pct = (beheerst / total) * 100;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="min-h-[100dvh] w-full font-sans" style={{ backgroundColor: COLORS.mainBg }}>
      <MobileTopBar />

      <main className="pb-24 pt-[54px]">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-4 pt-3 text-[11px]" style={{ color: COLORS.inkLight }}>
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Agenda</span>
          <span className="opacity-50">/</span>
          <span>Badje 2 — De schildpad</span>
          <span className="opacity-50">/</span>
          <span className="font-bold" style={{ color: COLORS.ink }}>Beoordelen</span>
        </div>

        {/* Header */}
        <div className="px-4 pt-3">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.ink }}>
            Beoordelen
          </h1>
          <p className="mt-1 text-xs" style={{ color: COLORS.inkLight }}>
            Badje 2 — De schildpad · Donderdag 15 mei 2026 · 09:30 – 10:15
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: COLORS.mint, borderColor: COLORS.accent, color: COLORS.ink }}
            >
              8/8 beoordeeld
            </span>
            <Button
              size="sm"
              className="gap-1.5 font-semibold shadow-none"
              style={{ backgroundColor: COLORS.ink, color: COLORS.surface }}
            >
              <Save className="h-3.5 w-3.5" />
              Opslaan
            </Button>
          </div>
        </div>

        {/* Card 1 — Leerlingen */}
        <div className="px-4 pt-5">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
            Leerlingen in groep (2)
          </div>
          <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
            <CardContent className="flex flex-col gap-2 p-2">
              {/* Emma — selected */}
              <div className="flex items-center gap-3 rounded-lg p-3" style={{ backgroundColor: COLORS.ink }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: COLORS.mint, color: COLORS.accent }}>
                  E
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">Emma de Jong</div>
                  <div className="text-[11px] text-white/70">62% voortgang</div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              </div>
              {/* Milan */}
              <div className="flex items-center gap-3 rounded-lg p-3" style={{ backgroundColor: COLORS.surface }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: "#e2e8f0", color: COLORS.inkLight }}>
                  M
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>Milan van Dijk</div>
                  <div className="text-[11px]" style={{ color: COLORS.inkLight }}>65% voortgang</div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Card 2 — Emma detail */}
        <div className="px-4 pt-4">
          <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-bold" style={{ backgroundColor: COLORS.mint, color: COLORS.accent }}>
                  E
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold" style={{ color: COLORS.ink }}>Emma de Jong</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Aanwezig
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: COLORS.inkLight }}>
                    9 jaar · Zwemdiploma A · Badje 2 — De schildpad
                  </div>
                </div>
              </div>

              {/* Progress block */}
              <div className="mt-4 flex items-center gap-4 rounded-xl p-3" style={{ backgroundColor: COLORS.mainBg }}>
                <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
                  <circle cx="36" cy="36" r={radius} fill="none" stroke={COLORS.mint} strokeWidth="8" />
                  <circle
                    cx="36"
                    cy="36"
                    r={radius}
                    fill="none"
                    stroke={COLORS.accent}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
                    transform="rotate(-90 36 36)"
                  />
                  <text x="36" y="40" textAnchor="middle" className="font-bold" fontSize="14" fill={COLORS.ink}>
                    {Math.round(pct)}%
                  </text>
                </svg>
                <div className="flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                    Beheerst
                  </div>
                  <div className="text-xl font-bold" style={{ color: COLORS.ink }}>
                    {beheerst}/{total}
                  </div>
                  <div className="text-[11px]" style={{ color: COLORS.inkLight }}>onderdelen</div>
                </div>
                <div className="flex flex-col gap-2">
                  <button className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: COLORS.border, color: COLORS.inkLight }}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: COLORS.border, color: COLORS.inkLight }}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Aanwezigheid */}
              <div className="mt-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                  Aanwezigheid — Emma
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5" style={{ borderColor: COLORS.accent, backgroundColor: COLORS.mint, color: COLORS.ink }}>
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-xs font-semibold">Aanwezig</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-200 bg-white px-3 py-1.5 text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    <span className="text-xs font-semibold">Te laat</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-200 bg-white px-3 py-1.5 text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    <span className="text-xs font-semibold">Afwezig</span>
                  </div>
                </div>
              </div>

              {/* Tab row */}
              <div className="mt-5 flex items-center gap-5 border-b" style={{ borderColor: COLORS.border }}>
                <button className="relative pb-2 text-sm font-bold" style={{ color: COLORS.ink }}>
                  Beoordelen
                  <span className="absolute inset-x-0 -bottom-px h-0.5" style={{ backgroundColor: COLORS.ink }} />
                </button>
                <button className="pb-2 text-sm font-medium" style={{ color: COLORS.inkLight }}>Notities</button>
                <button className="pb-2 text-sm font-medium" style={{ color: COLORS.inkLight }}>Badges</button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actieve module banner */}
        <div className="px-4 pt-4">
          <div className="rounded-xl border p-3" style={{ backgroundColor: COLORS.mint, borderColor: COLORS.accent }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
              Actieve module
            </div>
            <div className="mt-1 text-sm font-bold leading-snug" style={{ color: COLORS.ink }}>
              Badje 1 — De zeester · Veiligheid, vertrouwen en spelen in het water
            </div>
            <div className="mt-2 text-[11px]" style={{ color: COLORS.inkLight }}>
              Voortgangsstijl: <span className="font-semibold" style={{ color: COLORS.ink }}>Selectiebuttons</span>
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="px-4 pt-4">
          <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
            <CardContent className="p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                Legenda
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {LEVELS.map((l) => (
                  <div key={l.key} className="inline-flex items-center gap-1.5">
                    <span className={`h-3 w-3 rounded-full ${l.dot}`} />
                    <span className={`text-[11px] font-medium ${l.text}`}>{l.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Onderdelen */}
        <div className="px-4 pt-4">
          <div className="flex flex-col gap-2">
            {ONDERDELEN.map((o, i) => (
              <Card key={i} className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: COLORS.mint, color: COLORS.accent }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 text-sm font-semibold" style={{ color: COLORS.ink }}>
                      {o.name}
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0" style={{ color: COLORS.inkLight }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {LEVELS.map((l) => (
                      <SelectionPill key={l.key} level={l} selected={l.key === o.selected} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
