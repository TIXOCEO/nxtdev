import React, { useState } from "react";
import {
  Home,
  MessageSquare,
  ClipboardList,
  User,
  CheckCircle2,
  Bell,
  Check,
  Calendar,
  MapPin,
  Award,
  Clock,
  Shirt,
  Users2,
  PartyPopper,
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

type State = "received" | "available" | "scheduled";

const STATE_CHIPS: { key: State; label: string }[] = [
  { key: "received", label: "Aanvraag ontvangen" },
  { key: "available", label: "Plek vrijgekomen" },
  { key: "scheduled", label: "Ingepland" },
];

function StateReceived() {
  const bullets = [
    "Je voorkeuren zijn opgeslagen",
    "We houden rekening met wachtrijdruk",
    "Je hoort zo spoedig mogelijk meer",
  ];
  return (
    <div className="flex flex-col items-center gap-6 px-5 py-8 text-center">
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full"
        style={{ backgroundColor: COLORS.mint }}
      >
        <CheckCircle2 className="h-12 w-12" style={{ color: "#15803d" }} />
      </div>
      <div>
        <h2 className="text-xl font-bold" style={{ color: COLORS.ink }}>
          Aanvraag ontvangen!
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.inkLight }}>
          Bedankt voor je aanmelding voor Zwemdiploma A. We zoeken nu naar de beste plek op basis van jouw voorkeuren en de actuele wachtrij.
        </p>
      </div>
      <div
        className="flex w-full flex-col gap-2 rounded-2xl p-4 text-left shadow-sm"
        style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      >
        {bullets.map((b) => (
          <div key={b} className="flex items-center gap-3">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: COLORS.mint, color: "#15803d" }}
            >
              <Check className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm" style={{ color: COLORS.ink }}>
              {b}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs" style={{ color: COLORS.inkLight }}>
        Je ontvangt een bericht in de app én per e-mail
      </p>
    </div>
  );
}

function StateAvailable() {
  return (
    <div className="flex flex-col items-center gap-6 px-5 py-8 text-center">
      <div className="relative">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full"
          style={{ backgroundColor: "#fef3c7" }}
        >
          <Bell className="h-12 w-12" style={{ color: "#d97706" }} />
        </div>
        <span
          className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ring-4 ring-white"
          style={{ backgroundColor: "#ef4444" }}
        >
          1
        </span>
      </div>
      <div>
        <h2 className="text-xl font-bold" style={{ color: COLORS.ink }}>
          Er is een plek vrijgekomen!
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.inkLight }}>
          Reageer binnen 24 uur om de plek te behouden.
        </p>
      </div>
      <div
        className="flex w-full flex-col gap-3 rounded-2xl p-4 text-left shadow-sm"
        style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      >
        <DetailRow icon={Award} label="Programma" value="Zwemdiploma A" />
        <DetailRow icon={Calendar} label="Datum" value="Zaterdag 15 juni" />
        <DetailRow icon={Clock} label="Tijd" value="10:00 uur" />
      </div>
      <div className="flex w-full flex-col gap-2">
        <button
          className="w-full rounded-xl py-3.5 text-sm font-bold shadow-sm transition-all hover:brightness-95"
          style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
        >
          Accepteren
        </button>
        <button
          className="w-full rounded-xl py-3.5 text-sm font-bold transition-all hover:bg-black/5"
          style={{ border: `1.5px solid ${COLORS.border}`, color: COLORS.ink }}
        >
          Weigeren
        </button>
      </div>
      <button className="text-xs underline" style={{ color: COLORS.inkLight }}>
        Aanmelding annuleren
      </button>
    </div>
  );
}

function StateScheduled() {
  return (
    <div className="flex flex-col items-center gap-6 px-5 py-8 text-center">
      <div className="relative">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full"
          style={{ backgroundColor: "#166534" }}
        >
          <Check className="h-14 w-14 text-white" />
        </div>
        <PartyPopper
          className="absolute -right-3 -top-2 h-7 w-7 rotate-12"
          style={{ color: "#f59e0b" }}
        />
        <PartyPopper
          className="absolute -left-3 -bottom-1 h-6 w-6 -rotate-12"
          style={{ color: "#ec4899" }}
        />
      </div>
      <div>
        <h2 className="text-xl font-bold" style={{ color: COLORS.ink }}>
          Je bent ingepland! 🎉
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.inkLight }}>
          We kijken ernaar uit om Mila te verwelkomen.
        </p>
      </div>
      <div
        className="flex w-full flex-col gap-3 rounded-2xl p-4 text-left shadow-sm"
        style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      >
        <DetailRow icon={Award} label="Programma" value="Zwemdiploma A" />
        <DetailRow icon={Users2} label="Groep" value="Badje 2" />
        <DetailRow icon={Calendar} label="Datum" value="Zaterdag 15 juni 2025" />
        <DetailRow icon={Clock} label="Tijd" value="10:00 uur" />
        <DetailRow icon={MapPin} label="Locatie" value="Zwembad Houtrust" />
        <DetailRow icon={Shirt} label="Kleding" value="Zwemkleding, handdoek" />
      </div>
      <div className="flex w-full flex-col gap-2">
        <button
          className="w-full rounded-xl py-3.5 text-sm font-bold shadow-sm transition-all hover:brightness-95"
          style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
        >
          Zet de datum in agenda
        </button>
        <button
          className="w-full rounded-xl py-3.5 text-sm font-bold transition-all hover:bg-black/5"
          style={{ border: `1.5px solid ${COLORS.border}`, color: COLORS.ink }}
        >
          Bekijk details
        </button>
      </div>
      <p className="text-xs" style={{ color: COLORS.inkLight }}>
        Je ontvangt nog een herinnering
      </p>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: COLORS.mint, color: COLORS.accent }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
          {label}
        </div>
        <div className="mt-0.5 text-sm font-semibold" style={{ color: COLORS.ink }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function Plaatsing() {
  const [state, setState] = useState<State>("received");

  return (
    <div
      className="flex min-h-[100dvh] w-full justify-center font-sans"
      style={{ backgroundColor: "#0f1e3a14" }}
    >
      <div className="relative flex w-full max-w-[390px] flex-col" style={{ backgroundColor: COLORS.mainBg }}>
        {/* Header */}
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
          <h1 className="text-lg font-bold" style={{ color: COLORS.ink }}>
            Plaatsing
          </h1>
        </header>

        {/* State chip selector */}
        <div className="px-3 pt-4">
          <div
            className="flex items-center gap-1 rounded-full p-1 shadow-sm"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            {STATE_CHIPS.map((c) => {
              const active = state === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setState(c.key)}
                  className="flex-1 truncate rounded-full px-2 py-1.5 text-[11px] font-semibold transition-all"
                  style={{
                    backgroundColor: active ? COLORS.accent : "transparent",
                    color: active ? COLORS.ink : COLORS.inkLight,
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <main className="flex flex-1 flex-col pb-24">
          {state === "received" && <StateReceived />}
          {state === "available" && <StateAvailable />}
          {state === "scheduled" && <StateScheduled />}
        </main>

        {/* Tab bar */}
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
