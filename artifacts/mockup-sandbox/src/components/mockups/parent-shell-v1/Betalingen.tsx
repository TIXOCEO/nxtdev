import React, { useState } from "react";
import {
  Home,
  Users,
  Award,
  CalendarDays,
  MessageSquare,
  User,
  Settings,
  Bell,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  TrendingUp,
  Landmark,
  Download,
  Clock,
  Shield,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = {
  accent: "#b6d83b",
  accentDark: "#7fa823",
  ink: "#0f1e3a",
  inkLight: "#64748b",
  sidebarBg: "#f4f8eb",
  mainBg: "#fbfcf9",
  surface: "#ffffff",
  border: "rgba(15,30,58,0.08)",
  activeBg: "#e8f0d0",
  hoverBg: "#f0f4e0",
  cardShadow: "0 1px 2px rgba(15,30,58,0.04)",
};

interface NavItem {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: "Home" },
  { icon: Users, label: "Mijn kind(eren)" },
  { icon: Award, label: "Afzwemmen & diploma's" },
  { icon: CalendarDays, label: "Mijn lessen" },
  { icon: MessageSquare, label: "Mijn berichten", badge: "2" },
  { icon: User, label: "Profiel", active: true },
  { icon: Settings, label: "Instellingen" },
];

const MOBILE_TABS = [
  { icon: Home, label: "Home" },
  { icon: CalendarDays, label: "Lessen" },
  { icon: TrendingUp, label: "Voortgang" },
  { icon: MessageSquare, label: "Berichten" },
  { icon: User, label: "Profiel", active: true },
];

type InvoiceStatus = "paid" | "due" | "overdue";

interface Invoice {
  id: string;
  description: string;
  dueDate: string;
  amount: string;
  status: InvoiceStatus;
}

const INVOICES: Invoice[] = [
  { id: "#2025-042", description: "Lidmaatschap mei 2025", dueDate: "28 mei 2025", amount: "€ 47,50", status: "paid" },
  { id: "#2025-041", description: "Lidmaatschap april 2025", dueDate: "28 apr 2025", amount: "€ 47,50", status: "paid" },
  { id: "#2025-040", description: "Lidmaatschap maart 2025", dueDate: "28 mrt 2025", amount: "€ 47,50", status: "paid" },
  { id: "#2025-039", description: "Inschrijfgeld 2025", dueDate: "15 mrt 2025", amount: "€ 24,50", status: "due" },
  { id: "#2025-038", description: "Lidmaatschap februari 2025", dueDate: "28 feb 2025", amount: "€ 47,50", status: "paid" },
  { id: "#2025-037", description: "Lidmaatschap januari 2025", dueDate: "28 jan 2025", amount: "€ 47,50", status: "paid" },
];

const PREFERENCES = [
  { label: "Email-melding bij nieuwe factuur", on: true },
  { label: "Email-melding 3 dagen voor incasso", on: true },
  { label: "Herinnering bij openstaande factuur", on: true },
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
          className={(mobile ? "h-14 w-14 text-lg" : "h-14 w-14 text-lg lg:h-20 lg:w-20 lg:text-2xl") + " flex items-center justify-center rounded-2xl font-bold text-white shadow-sm"}
          style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})` }}
        >
          ZH
        </div>
        <div className="text-center">
          <div className="text-sm font-bold leading-tight lg:text-base" style={{ color: COLORS.ink }}>Zwemschool Houtrust</div>
          <div className="text-[11px] mt-0.5 lg:text-xs" style={{ color: COLORS.inkLight }}>Ouder omgeving</div>
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
                    style={{ backgroundColor: COLORS.accent }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="mt-auto px-3 py-3 text-center" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        <div className="text-[11px] font-medium" style={{ color: COLORS.inkLight }}>
          Powered by <span className="font-bold" style={{ color: COLORS.ink }}>NxtTrack</span>
        </div>
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
        <span>Profiel</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        <span className="font-bold" style={{ color: COLORS.ink }}>Betalingen</span>
      </div>
      <div className="flex items-center gap-5">
        <button className="relative">
          <Bell className="h-5 w-5" style={{ color: COLORS.inkLight }} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})` }}
          >
            PM
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>Papa of Mama</div>
            <div className="text-[11px]" style={{ color: COLORS.inkLight }}>Ouder</div>
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
          className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})` }}
        >
          ZH
        </div>
        <span className="text-sm font-bold" style={{ color: COLORS.ink }}>Zwemschool</span>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative">
          <Bell className="h-5 w-5" style={{ color: COLORS.inkLight }} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})` }}
        >
          PM
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
            <Icon className="h-5 w-5" style={{ color: t.active ? COLORS.accent : COLORS.inkLight }} />
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

function StatusPill({ status }: { status: InvoiceStatus }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
        Geïnd
      </span>
    );
  }
  if (status === "due") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
        <Clock className="h-3 w-3" />
        Openstaand
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
      <AlertCircle className="h-3 w-3" />
      Mislukt
    </span>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
      style={{ backgroundColor: on ? COLORS.accent : "#cbd5e1" }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(18px)" : "translateX(2px)" }}
      />
    </span>
  );
}

export default function Betalingen() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"alle" | "open" | "betaald">("alle");

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
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.ink }}>
              Betalingen 💳
            </h1>
            <p className="mt-1 text-sm" style={{ color: COLORS.inkLight }}>
              Overzicht van facturen, automatische incasso en betaalvoorkeuren voor Mila
            </p>

            <button
              className="mt-4 inline-flex items-center gap-2.5 rounded-full border bg-white px-2 py-1.5 pr-3 shadow-sm transition-all hover:shadow"
              style={{ borderColor: COLORS.border }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #22d3ee, #3b82f6)" }}
              >
                M
              </div>
              <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>Mila</span>
              <ChevronDown className="h-4 w-4" style={{ color: COLORS.inkLight }} />
            </button>
          </div>

          {/* 3 stat tiles */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <CardContent className="flex flex-col gap-1.5 p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                  Openstaand
                </div>
                <div className="text-3xl font-bold text-amber-600">€ 24,50</div>
                <div className="text-xs" style={{ color: COLORS.inkLight }}>1 factuur open</div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <CardContent className="flex flex-col gap-1.5 p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                  Volgende incasso
                </div>
                <div className="text-3xl font-bold" style={{ color: COLORS.ink }}>€ 47,50</div>
                <div className="text-xs" style={{ color: COLORS.inkLight }}>Wo 28 mei 2025</div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <CardContent className="flex flex-col gap-1.5 p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                  Betaalmethode
                </div>
                <div className="flex items-center gap-2">
                  <Landmark className="h-5 w-5" style={{ color: COLORS.accentDark }} />
                  <span className="text-base font-bold" style={{ color: COLORS.ink }}>Automatische incasso</span>
                </div>
                <div className="text-xs font-mono" style={{ color: COLORS.inkLight }}>NL12 ABCD •••• 4567 89</div>
              </CardContent>
            </Card>
          </div>

          {/* Facturen card */}
          <Card className="border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
            <div className="flex shrink-0 items-center justify-between p-5 pb-3">
              <h3 className="font-bold" style={{ color: COLORS.ink }}>Facturen</h3>
            </div>
            <CardContent className="p-5 pt-0">
              {/* Tabs */}
              <div className="flex items-center gap-1 border-b" style={{ borderColor: COLORS.border }}>
                {([
                  { key: "alle", label: "Alle" },
                  { key: "open", label: "Openstaand", badge: "1" },
                  { key: "betaald", label: "Betaald" },
                ] as const).map((t) => {
                  const active = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors"
                      style={{ color: active ? COLORS.ink : COLORS.inkLight }}
                    >
                      {t.label}
                      {"badge" in t && t.badge && (
                        <span
                          className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                          style={{ backgroundColor: COLORS.accent }}
                        >
                          {t.badge}
                        </span>
                      )}
                      {active && (
                        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ backgroundColor: COLORS.accent }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Table */}
              <div className="mt-4 hidden md:block">
                <div className="grid grid-cols-12 gap-3 px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>
                  <div className="col-span-2">Factuur</div>
                  <div className="col-span-4">Omschrijving</div>
                  <div className="col-span-2">Vervaldatum</div>
                  <div className="col-span-2">Bedrag</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                <div className="flex flex-col">
                  {INVOICES.map((inv) => (
                    <div
                      key={inv.id}
                      className="grid grid-cols-12 items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors hover:bg-slate-50"
                      style={{ borderTop: `1px solid ${COLORS.border}` }}
                    >
                      <div className="col-span-2 font-mono text-xs font-semibold" style={{ color: COLORS.ink }}>{inv.id}</div>
                      <div className="col-span-4 truncate" style={{ color: COLORS.ink }}>{inv.description}</div>
                      <div className="col-span-2 text-xs" style={{ color: COLORS.inkLight }}>{inv.dueDate}</div>
                      <div className="col-span-2 font-semibold" style={{ color: COLORS.ink }}>{inv.amount}</div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <StatusPill status={inv.status} />
                        {inv.status === "paid" ? (
                          <button className="rounded-md p-1.5 hover:bg-slate-100" aria-label="Download factuur">
                            <Download className="h-4 w-4" style={{ color: COLORS.inkLight }} />
                          </button>
                        ) : (
                          <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accentDark }}>Betaal nu →</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile list */}
              <div className="mt-4 flex flex-col gap-2 md:hidden">
                {INVOICES.map((inv) => (
                  <div key={inv.id} className="rounded-lg border p-3" style={{ borderColor: COLORS.border }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-semibold" style={{ color: COLORS.inkLight }}>{inv.id}</div>
                        <div className="truncate text-sm font-semibold" style={{ color: COLORS.ink }}>{inv.description}</div>
                        <div className="mt-0.5 text-[11px]" style={{ color: COLORS.inkLight }}>{inv.dueDate}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="text-sm font-bold" style={{ color: COLORS.ink }}>{inv.amount}</div>
                        <StatusPill status={inv.status} />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      {inv.status === "paid" ? (
                        <button className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.inkLight }}>
                          <Download className="h-3.5 w-3.5" /> PDF
                        </button>
                      ) : (
                        <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accentDark }}>Betaal nu →</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-center">
                <a href="#" className="text-xs font-semibold" style={{ color: COLORS.accentDark }}>
                  Bekijk alle facturen (12) →
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Incasso + Voorkeuren */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Incasso-machtiging */}
            <Card className="flex flex-col border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50">
                    <Shield className="h-4 w-4 text-green-600" />
                  </div>
                  <h3 className="font-bold" style={{ color: COLORS.ink }}>Incasso-machtiging</h3>
                </div>
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">Actief</span>
              </div>
              <CardContent className="flex flex-1 flex-col gap-4 p-5 pt-0">
                <div className="rounded-lg p-3" style={{ backgroundColor: "#f8fafc", border: `1px solid ${COLORS.border}` }}>
                  <div className="flex items-center gap-3">
                    <Landmark className="h-5 w-5" style={{ color: COLORS.accentDark }} />
                    <div className="font-mono text-sm font-semibold tracking-wide" style={{ color: COLORS.ink }}>
                      NL12 ABCD •••• 4567 89
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>Tenaamstelling</div>
                      <div className="mt-0.5" style={{ color: COLORS.ink }}>Papa of Mama</div>
                    </div>
                    <div>
                      <div className="font-semibold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>Machtiging</div>
                      <div className="mt-0.5" style={{ color: COLORS.ink }}>ZHM-2024-0123</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px]" style={{ color: COLORS.inkLight }}>
                    Afgegeven 12 mrt 2024
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="mt-auto w-full"
                  style={{ borderColor: COLORS.border, color: COLORS.ink }}
                >
                  Machtiging wijzigen
                </Button>
              </CardContent>
            </Card>

            {/* Betaalvoorkeuren */}
            <Card className="flex flex-col border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-5 pb-3">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Betaalvoorkeuren</h3>
              </div>
              <CardContent className="flex flex-1 flex-col gap-2 p-5 pt-0">
                {PREFERENCES.map((p) => (
                  <div
                    key={p.label}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-3"
                    style={{ border: `1px solid ${COLORS.border}` }}
                  >
                    <span className="text-sm" style={{ color: COLORS.ink }}>{p.label}</span>
                    <Toggle on={p.on} />
                  </div>
                ))}

                <div
                  className="mt-2 flex items-center justify-between gap-3 rounded-lg px-3 py-3"
                  style={{ border: `1px solid ${COLORS.border}` }}
                >
                  <span className="text-sm" style={{ color: COLORS.ink }}>Voorkeursdag voor incasso</span>
                  <button className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: COLORS.border, color: COLORS.ink }}>
                    Laatste werkdag
                    <ChevronDown className="h-3.5 w-3.5" style={{ color: COLORS.inkLight }} />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info banner */}
          <div
            className="flex items-start gap-3 rounded-xl p-4 text-white"
            style={{ background: "linear-gradient(135deg, #22d3ee, #3b82f6)" }}
          >
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-xs leading-relaxed">
              <span className="font-semibold">Veilig betalen via SEPA-incasso.</span>{" "}
              Je kunt elke afschrijving binnen 8 weken terugboeken via je bank.
            </div>
          </div>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
