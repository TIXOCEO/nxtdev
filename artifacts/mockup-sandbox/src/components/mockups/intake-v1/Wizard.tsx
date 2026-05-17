import React, { useState } from "react";
import {
  Home,
  MessageSquare,
  ClipboardList,
  User,
  ChevronDown,
  ChevronRight,
  Award,
  Calendar,
  Check,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const COLORS = {
  accent: "#b6d83b",
  ink: "#0f1e3a",
  inkLight: "#64748b",
  sidebarBg: "#f4f8eb",
  mainBg: "#f8fafc",
  surface: "#ffffff",
  border: "rgba(15,30,58,0.08)",
  mint: "#eaf3c9",
};

const TABS = [
  { icon: Home, label: "Home" },
  { icon: MessageSquare, label: "Berichten" },
  { icon: ClipboardList, label: "Intake", active: true },
  { icon: User, label: "Profiel" },
];

const SLOTS = [
  { day: "Woensdag", time: "16:00", pill: "Korte wachtrij", pillBg: "#dcfce7", pillColor: "#15803d", checked: true },
  { day: "Zaterdag", time: "09:00", pill: "Korte wachtrij", pillBg: "#dcfce7", pillColor: "#15803d", checked: true },
  { day: "Vrijdag", time: "15:30", pill: "Lange wachtrij", pillBg: "#fee2e2", pillColor: "#b91c1c", checked: false },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="px-1 text-sm font-bold" style={{ color: COLORS.ink }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function StepDots() {
  const steps = [1, 2, 3];
  return (
    <div className="flex items-center justify-center gap-2 px-2">
      {steps.map((s, i) => {
        const isActive = s === 1;
        const isDone = false;
        return (
          <React.Fragment key={s}>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
              style={{
                backgroundColor: isActive ? COLORS.accent : "#e2e8f0",
                color: isActive ? COLORS.ink : COLORS.inkLight,
              }}
            >
              {isDone ? <Check className="h-4 w-4" /> : s}
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-[2px] w-10 rounded-full"
                style={{ backgroundColor: i === 0 ? COLORS.accent : "#e2e8f0" }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Wizard() {
  const [checked, setChecked] = useState<boolean[]>(SLOTS.map((s) => s.checked));

  return (
    <div className="flex min-h-[100dvh] w-full justify-center font-sans" style={{ backgroundColor: "#0f1e3a14" }}>
      <div className="relative flex w-full max-w-[390px] flex-col" style={{ backgroundColor: COLORS.mainBg }}>
        {/* Top header with logo centered */}
        <header
          className="flex flex-col items-center gap-3 px-5 pb-4 pt-6"
          style={{ backgroundColor: COLORS.sidebarBg, borderBottom: `1px solid ${COLORS.border}` }}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold shadow-sm"
            style={{ backgroundColor: COLORS.surface, color: COLORS.accent, border: `1px solid ${COLORS.border}` }}
          >
            ZH
          </div>
          <div className="flex flex-col items-center gap-1">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: COLORS.inkLight }}
            >
              Stap 1 van 3
            </span>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: COLORS.accent }} />
              <h1 className="text-lg font-bold" style={{ color: COLORS.ink }}>
                Slimme intake
              </h1>
            </div>
          </div>
          <StepDots />
        </header>

        {/* Scrollable content */}
        <main className="flex flex-1 flex-col gap-6 px-5 pb-32 pt-6">
          {/* Programma */}
          <Section title="Programma">
            <button
              className="flex items-center gap-3 rounded-xl p-4 text-left shadow-sm"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: COLORS.mint, color: COLORS.accent }}
              >
                <Award className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                  Gekozen programma
                </div>
                <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>
                  Zwemdiploma A
                </div>
              </div>
              <ChevronDown className="h-4 w-4" style={{ color: COLORS.inkLight }} />
            </button>
          </Section>

          {/* Gegevens kind */}
          <Section title="Gegevens kind">
            <div
              className="rounded-xl p-4 shadow-sm"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <label className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                Voornaam
              </label>
              <div className="mt-1 text-sm font-semibold" style={{ color: COLORS.ink }}>
                Mila
              </div>
            </div>
            <div
              className="flex items-center gap-3 rounded-xl p-4 shadow-sm"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <Calendar className="h-4 w-4" style={{ color: COLORS.inkLight }} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                  Geboortedatum
                </div>
                <div className="mt-0.5 text-sm font-semibold" style={{ color: COLORS.ink }}>
                  12-03-2019
                </div>
              </div>
            </div>
            <button
              className="flex items-center gap-3 rounded-xl p-4 text-left shadow-sm"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                  Huidig niveau
                </div>
                <div className="mt-0.5 text-sm font-semibold" style={{ color: COLORS.ink }}>
                  Badje 1
                </div>
              </div>
              <ChevronDown className="h-4 w-4" style={{ color: COLORS.inkLight }} />
            </button>
          </Section>

          {/* Voorkeursmomenten */}
          <Section title="Kies je voorkeursmomenten (max. 3)">
            {SLOTS.map((s, i) => {
              const isChecked = checked[i];
              return (
                <button
                  key={s.day + s.time}
                  onClick={() => {
                    const next = [...checked];
                    next[i] = !next[i];
                    setChecked(next);
                  }}
                  className="flex items-center gap-3 rounded-xl p-4 text-left shadow-sm transition-all"
                  style={{
                    backgroundColor: COLORS.surface,
                    border: `1.5px solid ${isChecked ? COLORS.accent : COLORS.border}`,
                  }}
                >
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2"
                    style={{
                      borderColor: isChecked ? COLORS.accent : "#cbd5e1",
                      backgroundColor: isChecked ? COLORS.accent : "transparent",
                    }}
                  >
                    {isChecked && <Check className="h-3 w-3" style={{ color: COLORS.ink }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>
                      {s.day} · {s.time}
                    </div>
                    <div className="mt-1.5">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: s.pillBg, color: s.pillColor }}
                      >
                        {s.pill}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </Section>
        </main>

        {/* Sticky bottom CTA */}
        <div
          className="fixed bottom-[64px] left-1/2 z-30 w-full max-w-[390px] -translate-x-1/2 px-5 pb-3 pt-3"
          style={{ backgroundColor: COLORS.mainBg, borderTop: `1px solid ${COLORS.border}` }}
        >
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold shadow-sm transition-all hover:brightness-95"
            style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
          >
            Volgende stap
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Bottom tab bar */}
        <nav
          className="fixed bottom-0 left-1/2 z-40 flex h-16 w-full max-w-[390px] -translate-x-1/2 items-center justify-around border-t"
          style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.label} className="flex flex-1 flex-col items-center gap-1 py-2">
                <Icon className="h-5 w-5" style={{ color: t.active ? COLORS.ink : COLORS.inkLight }} />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: t.active ? COLORS.ink : COLORS.inkLight }}
                >
                  {t.label}
                </span>
                {t.active && (
                  <span className="h-1 w-1 rounded-full" style={{ backgroundColor: COLORS.accent }} />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
