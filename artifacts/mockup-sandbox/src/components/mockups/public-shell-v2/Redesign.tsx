import React, { useState } from "react";
import {
  Home,
  Newspaper,
  CalendarDays,
  Rss,
  CalendarPlus,
  Layers,
  ClipboardList,
  FileText,
  LogIn,
  Menu,
  ChevronRight,
  Instagram,
  Facebook,
  Youtube,
  MapPin,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// Colors
const COLORS = {
  accent: "#b6d83b",
  ink: "#0f1e3a",
  inkLight: "#2c3e5d",
  sidebarBg: "#f4f8eb", // soft mint/cream
  mainBg: "#fbfcf9",
  surface: "#ffffff",
  border: "#e5eada",
  activeBg: "#e5eed2",
};

interface NavItem {
  icon: React.ElementType;
  label: string;
  active?: boolean;
}

const ALGEMEEN_NAV: NavItem[] = [
  { icon: Home, label: "Home", active: true },
  { icon: Newspaper, label: "Nieuws" },
  { icon: CalendarDays, label: "Agenda" },
  { icon: Rss, label: "Feed" },
  { icon: CalendarPlus, label: "Proefles" },
  { icon: Layers, label: "Programma's" },
  { icon: ClipboardList, label: "Inschrijven" },
];

const PAGINAS_NAV: NavItem[] = [
  { icon: FileText, label: "Over ons" },
  { icon: FileText, label: "Contact" },
  { icon: FileText, label: "Veelgestelde vragen" },
];

const AGENDA_ITEMS = [
  { time: "15:00", title: "Zwemles Diploma A (Regulier)", day: "Vandaag" },
  { time: "16:00", title: "Zwemles Diploma B", day: "Vandaag" },
  { time: "17:00", title: "Zwemles Diploma C", day: "Vandaag" },
  { time: "09:00", title: "Ouder en Kind Zwemmen", day: "Morgen" },
  { time: "10:00", title: "Volwassenen Zwemles", day: "Morgen" },
];

const NEWS_ITEMS = [
  { date: "12 Okt", title: "Nieuwe kleedkamers geopend", excerpt: "We hebben de verbouwing afgerond en alle faciliteiten zijn nu beschikbaar..." },
  { date: "05 Okt", title: "Herfstvakantie rooster", excerpt: "Tijdens de vakantie hanteren we een aangepast lesrooster voor alle groepen..." },
  { date: "28 Sep", title: "Gediplomeerden gefeliciteerd!", excerpt: "Afgelopen weekend hebben 45 kinderen hun A of B diploma behaald..." },
  { date: "15 Sep", title: "Inschrijvingen nieuwe periode", excerpt: "Het is weer mogelijk om in te schrijven voor de volgende reeks lessen..." },
];

export function Redesign() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Branding */}
      <div className="flex items-center gap-3 p-4 lg:p-6 lg:pb-4">
        <div 
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold shadow-sm"
          style={{ backgroundColor: COLORS.surface, color: COLORS.accent, border: `1px solid ${COLORS.border}` }}
        >
          ZH
        </div>
        <div className="hidden flex-1 truncate lg:block">
          <h1 className="truncate font-bold tracking-tight" style={{ color: COLORS.ink }}>Zwemschool Houtrust</h1>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-6 py-2">
          {/* Algemeen */}
          <div>
            <h2 className="mb-2 hidden px-3 text-xs font-bold uppercase tracking-wider lg:block" style={{ color: COLORS.inkLight, opacity: 0.7 }}>
              Algemeen
            </h2>
            <nav className="flex flex-col gap-1">
              {ALGEMEEN_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    className="group relative flex w-full items-center justify-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all lg:justify-start lg:px-3"
                    style={{
                      color: item.active ? COLORS.ink : COLORS.inkLight,
                      backgroundColor: item.active ? COLORS.activeBg : "transparent",
                    }}
                  >
                    {item.active && (
                      <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full" style={{ backgroundColor: COLORS.accent }} />
                    )}
                    <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110 lg:h-4 lg:w-4" style={{ color: item.active ? COLORS.accent : "currentColor" }} />
                    <span className="hidden truncate lg:block">{item.label}</span>
                    
                    {/* Hover state overlay */}
                    {!item.active && (
                      <div className="absolute inset-0 rounded-lg opacity-0 transition-opacity group-hover:bg-black/5 group-hover:opacity-100" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Pagina's */}
          <div>
            <h2 className="mb-2 hidden px-3 text-xs font-bold uppercase tracking-wider lg:block" style={{ color: COLORS.inkLight, opacity: 0.7 }}>
              Pagina's
            </h2>
            <nav className="flex flex-col gap-1">
              {PAGINAS_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    className="group relative flex w-full items-center justify-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all hover:bg-black/5 lg:justify-start lg:px-3"
                    style={{ color: COLORS.inkLight }}
                  >
                    <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110 lg:h-4 lg:w-4" />
                    <span className="hidden truncate lg:block">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </ScrollArea>

      {/* Footer / Login */}
      <div className="mt-auto flex flex-col gap-2 p-4" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        <button
          className="group flex w-full items-center justify-center gap-3 rounded-lg py-2.5 text-sm font-semibold transition-all hover:bg-black/5 lg:justify-start lg:px-3"
          style={{ color: COLORS.ink }}
        >
          <LogIn className="h-5 w-5 shrink-0 lg:h-4 lg:w-4" style={{ color: COLORS.accent }} />
          <span className="hidden lg:block">Inloggen</span>
        </button>
        <div className="hidden items-center justify-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-wider lg:flex" style={{ color: COLORS.inkLight }}>
          <span>Powered by</span>
          <span className="font-bold" style={{ color: COLORS.accent }}>NXTTRACK</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] w-full font-sans" style={{ backgroundColor: COLORS.mainBg }}>
      
      {/* Mobile Top Bar */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b px-4 sm:hidden" style={{ backgroundColor: COLORS.sidebarBg, borderColor: COLORS.border }}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg font-bold shadow-sm" style={{ backgroundColor: COLORS.surface, color: COLORS.accent }}>ZH</div>
          <span className="font-bold" style={{ color: COLORS.ink }}>Houtrust</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2" style={{ color: COLORS.ink }}>
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-14 z-40 bg-black/20 sm:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-y-0 left-0 w-64 shadow-xl" style={{ backgroundColor: COLORS.sidebarBg }} onClick={e => e.stopPropagation()}>
             {/* Note: In a real app we'd reuse renderSidebarContent() and force labels to show, 
                 but for simplicity in this single component, we just render the sidebar content which behaves mostly right.
                 To make it perfect, we'd add some mobile-specific overrides. 
                 Since the mockup just needs to work, we'll let it be. */}
            <div className="flex h-full flex-col">
              <ScrollArea className="flex-1 px-3 pt-4">
                <nav className="flex flex-col gap-1">
                  {ALGEMEEN_NAV.map((item) => (
                    <button key={item.label} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium" style={{ color: item.active ? COLORS.ink : COLORS.inkLight, backgroundColor: item.active ? COLORS.activeBg : "transparent" }}>
                      <item.icon className="h-5 w-5 shrink-0" style={{ color: item.active ? COLORS.accent : "currentColor" }} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                  <div className="my-2 border-t" style={{ borderColor: COLORS.border }} />
                  {PAGINAS_NAV.map((item) => (
                    <button key={item.label} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium" style={{ color: COLORS.inkLight }}>
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>
              </ScrollArea>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Desktop/Tablet */}
      <aside 
        className="hidden shrink-0 flex-col sm:flex sm:w-[72px] lg:w-[260px]"
        style={{ 
          backgroundColor: COLORS.sidebarBg, 
          borderRight: `1px solid ${COLORS.border}`,
          position: "sticky",
          top: 0,
          height: "100vh"
        }}
      >
        {renderSidebarContent()}
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col pt-14 sm:pt-0">
        
        {/* Header Strip */}
        <header className="flex h-14 shrink-0 items-center px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: COLORS.inkLight }}>
            <Home className="h-4 w-4" />
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            <span style={{ color: COLORS.ink }}>Welkom bij Zwemschool Houtrust</span>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 pt-2 sm:pt-2">
          
          {/* Hero Strip */}
          <div className="relative overflow-hidden rounded-2xl shadow-sm" style={{ height: "240px" }}>
            <img 
              src="https://picsum.photos/seed/houtrust-1/1200/400" 
              alt="Zwemschool hero" 
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1e3a]/80 via-[#0f1e3a]/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
              <div>
                <Badge className="mb-3 font-semibold border-none" style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}>
                  Nieuwe periode
                </Badge>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">Inschrijvingen Diploma A geopend</h2>
              </div>
              <div className="hidden gap-1.5 sm:flex">
                <div className="h-1.5 w-6 rounded-full bg-white" />
                <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
              </div>
            </div>
          </div>

          {/* Module Grid */}
          <div 
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:[grid-auto-rows:340px]"
          >
            {/* Welcome Block */}
            <Card className="flex h-full flex-col lg:overflow-hidden border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <CardContent className="flex h-full flex-col p-6">
                <div className="mb-4 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: COLORS.sidebarBg, color: COLORS.accent }}>
                  <Home className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-xl font-bold" style={{ color: COLORS.ink }}>Welkom bij Houtrust</h3>
                <p className="mb-6 flex-1 text-sm leading-relaxed" style={{ color: COLORS.inkLight }}>
                  Al meer dan 20 jaar de leukste en veiligste zwemschool van Den Haag. Wij bieden zwemlessen voor jong en oud, met persoonlijke aandacht en gediplomeerde instructeurs.
                </p>
                <a href="#" className="mt-auto inline-flex w-fit items-center gap-2 text-sm font-semibold transition-colors hover:opacity-80" style={{ color: COLORS.accent }}>
                  <span>Lees meer over ons</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>

            {/* Agenda (Fixed Alignment) */}
            <Card className="flex h-full flex-col lg:overflow-hidden border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-6 pb-4">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Aankomende sessies</h3>
                <CalendarDays className="h-4 w-4" style={{ color: COLORS.accent }} />
              </div>
              <CardContent className="flex flex-1 flex-col lg:overflow-hidden px-4 pb-6 pt-0">
                <ScrollArea className="h-full pr-2">
                  <div className="flex flex-col gap-1">
                    {AGENDA_ITEMS.map((item, i) => (
                      <div key={i} className="flex min-h-[44px] items-center rounded-lg px-2 transition-colors hover:bg-black/5">
                        <span className="w-11 shrink-0 text-sm font-bold" style={{ color: COLORS.inkLight }}>{item.time}</span>
                        <div className="mx-3 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: COLORS.accent }} />
                        <span className="flex-1 truncate text-sm font-medium" style={{ color: COLORS.ink }}>{item.title}</span>
                        <Badge variant="outline" className="ml-3 shrink-0 px-2 py-0 text-[10px] uppercase" style={{ borderColor: COLORS.border, color: COLORS.inkLight }}>
                          {item.day}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Nieuws */}
            <Card className="flex h-full flex-col lg:overflow-hidden border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-6 pb-4">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Laatste nieuws</h3>
                <Newspaper className="h-4 w-4" style={{ color: COLORS.accent }} />
              </div>
              <CardContent className="flex-1 lg:overflow-hidden p-0">
                <ScrollArea className="h-full px-6 pb-6">
                  <div className="flex flex-col gap-5">
                    {NEWS_ITEMS.map((item, i) => (
                      <div key={i} className="group cursor-pointer border-l-2 pl-4 transition-colors" style={{ borderColor: i === 0 ? COLORS.accent : COLORS.border }}>
                        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.inkLight }}>{item.date}</div>
                        <h4 className="mb-1 text-sm font-semibold transition-colors group-hover:opacity-80" style={{ color: COLORS.ink }}>{item.title}</h4>
                        <p className="line-clamp-2 text-xs" style={{ color: COLORS.inkLight }}>{item.excerpt}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Event Card */}
            <Card className="flex h-full flex-col lg:overflow-hidden border-none shadow-sm sm:col-span-2 lg:col-span-2" style={{ backgroundColor: COLORS.ink }}>
              <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/3 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ backgroundColor: COLORS.accent }} />
              <CardContent className="relative flex h-full flex-row p-0">
                <div className="flex w-24 shrink-0 flex-col items-center justify-center border-r border-white/10 sm:w-32" style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>
                  <span className="text-sm font-bold uppercase tracking-widest text-white/70">Okt</span>
                  <span className="text-4xl font-bold text-white sm:text-5xl">28</span>
                </div>
                <div className="flex flex-1 flex-col justify-center p-6 sm:p-8">
                  <Badge className="mb-3 w-fit border-none" style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}>Evenement</Badge>
                  <h3 className="mb-2 text-xl font-bold text-white sm:text-2xl">Afzwemmen Diploma A & B</h3>
                  <p className="mb-6 max-w-md line-clamp-2 text-sm text-white/70 sm:line-clamp-none">
                    Kom kijken naar onze helden die hun zwemdiploma gaan halen. Familie en vrienden zijn van harte welkom op de tribune!
                  </p>
                  <Button className="mt-auto w-fit font-bold shadow-none" style={{ backgroundColor: COLORS.accent, color: COLORS.ink }}>
                    Meld je aan
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Locatie */}
            <Card className="flex h-full flex-col lg:overflow-hidden border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
              <div className="relative h-40 w-full shrink-0 bg-slate-100">
                <img src="https://picsum.photos/seed/map/400/200" alt="Map" className="h-full w-full object-cover opacity-80" />
                <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
                  <MapPin className="h-5 w-5" style={{ color: COLORS.ink }} />
                </div>
              </div>
              <CardContent className="flex flex-1 flex-col p-6">
                <h3 className="mb-1 font-bold" style={{ color: COLORS.ink }}>Zwembad de Houtrust</h3>
                <p className="text-sm" style={{ color: COLORS.inkLight }}>Houtrustweg 100<br />2583 AS Den Haag</p>
                <a href="#" className="mt-auto inline-flex w-fit items-center gap-2 text-sm font-semibold transition-colors hover:opacity-80" style={{ color: COLORS.accent }}>
                  <span>Routebeschrijving</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>

            {/* Foto's */}
            <Card className="flex h-full flex-col lg:overflow-hidden border-none shadow-sm" style={{ backgroundColor: COLORS.surface }}>
               <div className="flex shrink-0 items-center justify-between p-6 pb-4">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Uitgelicht</h3>
              </div>
              <CardContent className="flex-1 p-6 pt-0">
                <div className="grid h-full grid-cols-2 grid-rows-2 gap-2">
                  <img src="https://picsum.photos/seed/houtrust-2/300/300" alt="Zwemmen 1" className="h-full w-full rounded-lg object-cover" />
                  <img src="https://picsum.photos/seed/houtrust-3/300/300" alt="Zwemmen 2" className="h-full w-full rounded-lg object-cover" />
                  <img src="https://picsum.photos/seed/houtrust-4/300/300" alt="Zwemmen 3" className="h-full w-full rounded-lg object-cover" />
                  <img src="https://picsum.photos/seed/houtrust-5/300/300" alt="Zwemmen 4" className="h-full w-full rounded-lg object-cover" />
                </div>
              </CardContent>
            </Card>

            {/* Trainers */}
            <Card className="flex h-full flex-col lg:overflow-hidden border-none shadow-sm sm:col-span-2 lg:col-span-2" style={{ backgroundColor: COLORS.surface }}>
              <div className="flex shrink-0 items-center justify-between p-6 pb-4">
                <h3 className="font-bold" style={{ color: COLORS.ink }}>Onze Instructeurs</h3>
                <a href="#" className="text-sm font-semibold hover:underline" style={{ color: COLORS.inkLight }}>Bekijk allen</a>
              </div>
              <CardContent className="flex-1 p-6 pt-0">
                <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    { name: "Lisa de Vries", role: "Hoofdinstructeur", init: "LV" },
                    { name: "Mark Janssen", role: "Instructeur B/C", init: "MJ" },
                    { name: "Sarah Bakker", role: "Ouder & Kind", init: "SB" }
                  ].map((trainer, i) => (
                    <div key={i} className="flex flex-col items-center justify-center rounded-xl p-4 text-center transition-colors hover:bg-black/5" style={{ border: `1px solid ${COLORS.border}` }}>
                      <Avatar className="mb-3 h-16 w-16" style={{ border: `2px solid ${COLORS.sidebarBg}` }}>
                        <AvatarImage src={`https://i.pravatar.cc/150?u=${trainer.init}`} />
                        <AvatarFallback style={{ backgroundColor: COLORS.sidebarBg, color: COLORS.accent, fontWeight: "bold" }}>{trainer.init}</AvatarFallback>
                      </Avatar>
                      <h4 className="font-bold" style={{ color: COLORS.ink }}>{trainer.name}</h4>
                      <p className="text-xs" style={{ color: COLORS.inkLight }}>{trainer.role}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Footer */}
        <footer className="mt-auto px-6 py-6" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm font-medium" style={{ color: COLORS.inkLight }}>
              © {new Date().getFullYear()} Zwemschool Houtrust
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="transition-opacity hover:opacity-70" style={{ color: COLORS.inkLight }}><Instagram className="h-5 w-5" /></a>
              <a href="#" className="transition-opacity hover:opacity-70" style={{ color: COLORS.inkLight }}><Facebook className="h-5 w-5" /></a>
              <a href="#" className="transition-opacity hover:opacity-70" style={{ color: COLORS.inkLight }}><Youtube className="h-5 w-5" /></a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
