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
  ChevronDown,
  Menu,
  User,
  X,
  Search,
  Plus,
  Shield,
  ClipboardList,
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
  { icon: MessageSquare, label: "Berichten", badge: "5" },
  { icon: Users2, label: "Groepen" },
  { icon: CheckSquare, label: "Taken", badge: "2" },
  { icon: FileText, label: "Documenten", active: true },
  { icon: Library, label: "Handleidingen" },
];

const MOBILE_TABS = [
  { icon: Home, label: "Home" },
  { icon: CalendarDays, label: "Agenda" },
  { icon: BookOpen, label: "Lessen" },
  { icon: MessageSquare, label: "Berichten" },
  { icon: User, label: "Profiel" },
];

const CATEGORIES = ["Alle", "Algemeen", "Lesmateriaal", "Protocollen", "Formulieren"];

type CategoryKey = "Algemeen" | "Lesmateriaal" | "Protocollen" | "Formulieren";

const CATEGORY_META: Record<CategoryKey, { icon: React.ElementType; chipBg: string; chipColor: string; pillBg: string; pillColor: string }> = {
  Algemeen: { icon: FileText, chipBg: "#dbeafe", chipColor: "#2563eb", pillBg: "#eff6ff", pillColor: "#1d4ed8" },
  Lesmateriaal: { icon: BookOpen, chipBg: "#dcfce7", chipColor: "#16a34a", pillBg: "#f0fdf4", pillColor: "#15803d" },
  Protocollen: { icon: Shield, chipBg: "#ede9fe", chipColor: "#7c3aed", pillBg: "#f5f3ff", pillColor: "#6d28d9" },
  Formulieren: { icon: ClipboardList, chipBg: "#fef3c7", chipColor: "#d97706", pillBg: "#fffbeb", pillColor: "#b45309" },
};

interface DocRow {
  name: string;
  category: CategoryKey;
  by: string;
  date: string;
}

const DOCS: DocRow[] = [
  { name: "Zomerrooster 2025.pdf", category: "Algemeen", by: "SJ", date: "09 mei 2025" },
  { name: "Lesschema Badje 1.pdf", category: "Lesmateriaal", by: "SJ", date: "08 mei 2025" },
  { name: "Protocol ziekte & hygiene.pdf", category: "Protocollen", by: "MJ", date: "05 mei 2025" },
  { name: "Evaluatieformulier les.pdf", category: "Formulieren", by: "SJ", date: "02 mei 2025" },
  { name: "EHBO instructies.pdf", category: "Protocollen", by: "LdV", date: "30 apr 2025" },
  { name: "Lesmateriaal drijven.docx", category: "Lesmateriaal", by: "SJ", date: "29 apr 2025" },
  { name: "Inschrijfformulier 2025.pdf", category: "Formulieren", by: "SJ", date: "28 apr 2025" },
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
        <span className="font-bold" style={{ color: COLORS.ink }}>Documenten</span>
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

export default function Documenten() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeCat, setActiveCat] = useState("Alle");

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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.ink }}>
                <span className="inline-block h-7 w-1 rounded-full mr-3 align-middle" style={{ backgroundColor: "#1e3a5f" }} />
                Documenten
              </h1>
              <p className="mt-1 text-sm" style={{ color: COLORS.inkLight }}>
                Vind snel alle belangrijke documenten en bestanden
              </p>
            </div>
            <button
              className="inline-flex items-center gap-2 self-start rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-all hover:shadow"
              style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}
            >
              <Plus className="h-4 w-4" />
              Nieuw document
            </button>
          </div>

          {/* Filter row */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: COLORS.inkLight }} />
              <input
                type="text"
                placeholder="Zoek in documenten…"
                className="w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-all focus:border-transparent focus:ring-2"
                style={{ borderColor: COLORS.border, color: COLORS.ink }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORIES.map((c) => {
                  const isActive = c === activeCat;
                  return (
                    <button
                      key={c}
                      onClick={() => setActiveCat(c)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: isActive ? COLORS.accent : COLORS.surface,
                        color: COLORS.ink,
                        border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`,
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-semibold"
                style={{ borderColor: COLORS.border, color: COLORS.ink }}
              >
                Meest recent
                <ChevronDown className="h-3.5 w-3.5" style={{ color: COLORS.inkLight }} />
              </button>
            </div>
          </div>

          {/* Documents table card */}
          <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
            <CardContent className="p-0">
              {/* Desktop table header */}
              <div
                className="hidden grid-cols-12 gap-4 border-b px-5 py-3 text-[10px] font-bold uppercase tracking-wider lg:grid"
                style={{ color: COLORS.inkLight, borderColor: COLORS.border }}
              >
                <div className="col-span-5">Naam</div>
                <div className="col-span-2">Categorie</div>
                <div className="col-span-2">Geplaatst door</div>
                <div className="col-span-2">Geplaatst op</div>
                <div className="col-span-1 text-right">Acties</div>
              </div>

              <div className="flex flex-col">
                {DOCS.map((doc, i) => {
                  const meta = CATEGORY_META[doc.category];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02] sm:px-5 lg:grid-cols-12 lg:gap-4"
                      style={{ borderTop: i === 0 ? "none" : `1px solid ${COLORS.border}` }}
                    >
                      <div className="flex min-w-0 items-center gap-3 lg:col-span-5">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: meta.chipBg, color: meta.chipColor }}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold" style={{ color: COLORS.ink }}>{doc.name}</div>
                          <div className="mt-0.5 truncate text-[11px] lg:hidden" style={{ color: COLORS.inkLight }}>
                            {doc.category} · {doc.by} · {doc.date}
                          </div>
                        </div>
                      </div>

                      <div className="hidden lg:col-span-2 lg:block">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ backgroundColor: meta.pillBg, color: meta.pillColor }}
                        >
                          {doc.category}
                        </span>
                      </div>

                      <div className="hidden items-center gap-2 lg:col-span-2 lg:flex">
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: COLORS.mint, color: COLORS.ink }}
                        >
                          {doc.by}
                        </div>
                        <span className="text-xs" style={{ color: COLORS.inkLight }}>{doc.by}</span>
                      </div>

                      <div className="hidden lg:col-span-2 lg:block">
                        <span className="text-xs" style={{ color: COLORS.inkLight }}>{doc.date}</span>
                      </div>

                      <div className="hidden lg:col-span-1 lg:flex lg:justify-end">
                        <button
                          className="rounded-md p-1.5 transition-colors hover:bg-black/5"
                          style={{ color: COLORS.inkLight }}
                          aria-label="Meer opties"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
