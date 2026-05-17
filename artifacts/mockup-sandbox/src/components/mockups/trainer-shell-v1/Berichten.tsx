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
  Search,
  Plus,
  Paperclip,
  Send,
  MoreHorizontal,
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
  activeBg: "#e8f0d0",
  hoverBg: "#f0f4e0",
  mint: "#eef5d8",
  bubbleGrey: "#f1f3ef",
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
  { icon: Users, label: "Leerlingen" },
  { icon: MessageSquare, label: "Berichten", badge: "5", active: true },
  { icon: Users2, label: "Groepen" },
  { icon: CheckSquare, label: "Taken", badge: "2" },
  { icon: FileText, label: "Documenten" },
  { icon: Library, label: "Handleidingen" },
];

const MOBILE_TABS = [
  { icon: Home, label: "Home" },
  { icon: CalendarDays, label: "Agenda" },
  { icon: BookOpen, label: "Lessen" },
  { icon: MessageSquare, label: "Berichten", active: true },
  { icon: User, label: "Profiel" },
];

interface Conversation {
  name: string;
  meta?: string;
  preview: string;
  time: string;
  badge?: string;
  active?: boolean;
  initials: string;
  avatarBg: string;
  avatarColor: string;
}

const CONVERSATIONS: Conversation[] = [
  {
    name: "Team instructeurs",
    preview: "Teamoverleg woensdag 14 mei om 19:00 uur",
    time: "Wo 13:42",
    active: true,
    initials: "TI",
    avatarBg: "#e8f0d0",
    avatarColor: "#0f1e3a",
  },
  {
    name: "Emma de Jong",
    meta: "ouder",
    preview: "Bedankt voor de fijne les van vandaag!",
    time: "09:21",
    badge: "2",
    initials: "EJ",
    avatarBg: "#dbeafe",
    avatarColor: "#1d4ed8",
  },
  {
    name: "Lisa de Vries",
    meta: "ouder",
    preview: "Noah heeft zijn badge gehaald!",
    time: "Gisteren",
    initials: "LV",
    avatarBg: "#fce7f3",
    avatarColor: "#be185d",
  },
  {
    name: "Zwemschool Demo",
    preview: "Nieuwe materialen beschikbaar in de berging",
    time: "Vr",
    initials: "ZD",
    avatarBg: "#fef3c7",
    avatarColor: "#b45309",
  },
  {
    name: "Mark Jansen",
    preview: "Kun je morgen mijn les overnemen?",
    time: "12 mei",
    initials: "MJ",
    avatarBg: "#ede9fe",
    avatarColor: "#6d28d9",
  },
  {
    name: "Groep: Badje 1 — De zeester",
    preview: "Vergeet niet de spullen mee te nemen",
    time: "Ma",
    initials: "B1",
    avatarBg: "#dcfce7",
    avatarColor: "#15803d",
  },
];

interface Message {
  side: "left" | "right";
  author: string;
  initials: string;
  avatarBg: string;
  avatarColor: string;
  text: string;
  time: string;
}

const MESSAGES: Message[] = [
  {
    side: "left",
    author: "Sophie",
    initials: "SJ",
    avatarBg: "#0f1e3a",
    avatarColor: "#ffffff",
    text: "Teamoverleg woensdag 14 mei om 19:00 uur. Locatie: Kantoor. Agendapunten: Evaluatie meivakantie, Nieuwe lesmaterialen, Zomerrooster.",
    time: "06:32",
  },
  {
    side: "right",
    author: "Ik",
    initials: "IK",
    avatarBg: "#b6d83b",
    avatarColor: "#0f1e3a",
    text: "Is ben erbij",
    time: "06:49",
  },
  {
    side: "left",
    author: "LdV",
    initials: "LV",
    avatarBg: "#fce7f3",
    avatarColor: "#be185d",
    text: "Aanwezig",
    time: "06:52",
  },
  {
    side: "left",
    author: "Mark",
    initials: "MJ",
    avatarBg: "#ede9fe",
    avatarColor: "#6d28d9",
    text: "Top, ik kom ook",
    time: "07:01",
  },
];

const TABS = [
  { label: "Alle", active: true },
  { label: "Ongelezen", badge: "3" },
  { label: "Vermeldingen" },
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
        <span className="font-bold" style={{ color: COLORS.ink }}>Berichten</span>
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

function ConversationList() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-3" style={{ borderColor: COLORS.border }}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: COLORS.inkLight }} />
          <input
            type="text"
            placeholder="Zoek gesprek…"
            className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm outline-none"
            style={{ borderColor: COLORS.border, color: COLORS.ink }}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {CONVERSATIONS.map((c, i) => (
            <button
              key={i}
              className="relative flex w-full items-start gap-3 border-b px-3 py-3 text-left transition-colors"
              style={{
                borderColor: COLORS.border,
                backgroundColor: c.active ? COLORS.activeBg : "transparent",
              }}
              onMouseEnter={(e) => { if (!c.active) e.currentTarget.style.backgroundColor = COLORS.hoverBg; }}
              onMouseLeave={(e) => { if (!c.active) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {c.active && (
                <div className="absolute left-0 top-0 h-full w-[3px]" style={{ backgroundColor: COLORS.accent }} />
              )}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: c.avatarBg, color: c.avatarColor }}
              >
                {c.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold" style={{ color: COLORS.ink }}>
                    {c.name}
                    {c.meta && <span className="ml-1 text-[11px] font-normal" style={{ color: COLORS.inkLight }}>({c.meta})</span>}
                  </div>
                  <div className="shrink-0 text-[11px]" style={{ color: COLORS.inkLight }}>{c.time}</div>
                </div>
                <div className="mt-0.5 truncate text-xs" style={{ color: COLORS.inkLight }}>{c.preview}</div>
              </div>
              {c.badge && (
                <span
                  className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: COLORS.ink }}
                >
                  {c.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ConversationView() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-5 py-3"
        style={{ borderColor: COLORS.border }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
            style={{ backgroundColor: COLORS.activeBg, color: COLORS.ink }}
          >
            TI
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: COLORS.ink }}>Team instructeurs</div>
            <div className="text-[11px]" style={{ color: COLORS.inkLight }}>5 deelnemers</div>
          </div>
        </div>
        <button className="rounded-md p-1.5 hover:bg-black/5" style={{ color: COLORS.inkLight }}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Thread */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-5">
          {MESSAGES.map((m, i) => {
            const isRight = m.side === "right";
            return (
              <div key={i} className={`flex items-end gap-2 ${isRight ? "flex-row-reverse" : "flex-row"}`}>
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: m.avatarBg, color: m.avatarColor }}
                >
                  {m.initials}
                </div>
                <div className={`flex max-w-[75%] flex-col ${isRight ? "items-end" : "items-start"}`}>
                  <div
                    className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                    style={{
                      backgroundColor: isRight ? COLORS.accent : COLORS.bubbleGrey,
                      color: COLORS.ink,
                      borderBottomRightRadius: isRight ? 4 : undefined,
                      borderBottomLeftRadius: !isRight ? 4 : undefined,
                    }}
                  >
                    {!isRight && (
                      <div className="mb-0.5 text-[11px] font-bold" style={{ color: COLORS.inkLight }}>
                        {m.author}
                      </div>
                    )}
                    {m.text}
                  </div>
                  <div className="mt-1 text-[10px]" style={{ color: COLORS.inkLight }}>{m.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="shrink-0 border-t p-3" style={{ borderColor: COLORS.border }}>
        <div
          className="flex items-end gap-2 rounded-xl border bg-white p-2"
          style={{ borderColor: COLORS.border }}
        >
          <button className="rounded-md p-2 hover:bg-black/5" style={{ color: COLORS.inkLight }} aria-label="Bijlage">
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            rows={1}
            placeholder="Typ je bericht…"
            className="min-h-[36px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm outline-none"
            style={{ color: COLORS.ink }}
          />
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm"
            style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
            aria-label="Verzenden"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Berichten() {
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
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.ink }}>
              Berichten
            </h1>
            <button
              className="inline-flex items-center gap-2 self-start rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-all hover:shadow"
              style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
            >
              <Plus className="h-4 w-4" />
              Nieuw bericht
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b" style={{ borderColor: COLORS.border }}>
            {TABS.map((t) => (
              <button
                key={t.label}
                className="relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors"
                style={{ color: t.active ? COLORS.ink : COLORS.inkLight }}
              >
                {t.label}
                {t.badge && (
                  <span
                    className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ backgroundColor: COLORS.ink }}
                  >
                    {t.badge}
                  </span>
                )}
                {t.active && (
                  <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full" style={{ backgroundColor: COLORS.accent }} />
                )}
              </button>
            ))}
          </div>

          {/* Split view */}
          <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-12" style={{ height: "calc(100dvh - 280px)", minHeight: 520 }}>
                {/* LEFT */}
                <div className="lg:col-span-4 lg:border-r" style={{ borderColor: COLORS.border }}>
                  <ConversationList />
                </div>
                {/* RIGHT */}
                <div className="hidden lg:col-span-8 lg:block">
                  <ConversationView />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
