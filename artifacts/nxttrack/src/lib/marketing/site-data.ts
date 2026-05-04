/**
 * Centrale data voor de marketingsite.
 *
 * Hier staan alle features, sectoren, navigatie-items, roadmap-onderwerpen en
 * statistieken. Pagina's lezen uit deze constanten zodat content op één plek
 * onderhouden wordt.
 */
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Compass,
  Dumbbell,
  FileBadge,
  Flame,
  Footprints,
  GraduationCap,
  HeartHandshake,
  ImageIcon,
  LayoutGrid,
  LineChart,
  Lock,
  Mail,
  MessagesSquare,
  Music,
  PieChart,
  Receipt,
  Rocket,
  Rss,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Sword,
  Target,
  Trophy,
  Users,
  Waves,
  Zap,
} from "lucide-react";

export const SITE = {
  name: "NXTTRACK",
  tagline: "Elke sporter. Elke stap.",
  description:
    "Het complete clubplatform voor sportverenigingen, academies, zwemscholen en sportscholen. Eén systeem voor ontwikkeling, organisatie en clubbeleving.",
  logoSrc: "https://dgwebservices.nl/logonxttrack.svg",
  email: "hallo@nxttrack.nl",
  phone: "+31 (0)85 — coming soon",
  url: "https://nxttrack.nl",
} as const;

export type FeatureSlug =
  | "leerlingvolgsysteem"
  | "gamification"
  | "clubfeed"
  | "ledenbeheer"
  | "certificaten"
  | "communicatie";

export interface Feature {
  slug: FeatureSlug;
  href: string;
  title: string;
  short: string;
  long: string;
  icon: LucideIcon;
  highlights: string[];
  bullets: { icon: LucideIcon; title: string; body: string }[];
}

export const FEATURES: Feature[] = [
  {
    slug: "leerlingvolgsysteem",
    href: "/features/leerlingvolgsysteem",
    title: "Modulair leerlingvolgsysteem",
    short:
      "Volg de ontwikkeling van elke sporter, stap voor stap, in jouw eigen structuur.",
    long:
      "Bouw je eigen ontwikkelingssysteem met categorieën, modules en concrete onderdelen. Trainers leggen voortgang vast op de manier die past bij jouw club: tekstueel, met sterren of met emoji's. Sporters en ouders zien duidelijke voortgang per module zonder onderlinge vergelijking.",
    icon: Target,
    highlights: [
      "Onbeperkte categorieën, modules en onderdelen",
      "Drie beoordelingsstijlen: tekst, sterren of emoji",
      "Voortgang per sporter, per groep en per team",
      "Volledige ontwikkelingshistorie blijft bewaard",
    ],
    bullets: [
      {
        icon: LayoutGrid,
        title: "Modulair opgebouwd",
        body: "Categorie → module → onderdeel. Ontwerp je eigen leerlijn die past bij jouw sport.",
      },
      {
        icon: Star,
        title: "Drie beoordelingsstijlen",
        body: "Kies per onderdeel of module hoe trainers voortgang aangeven: tekstueel, met sterren of emoji's.",
      },
      {
        icon: LineChart,
        title: "Inzichtelijke voortgang",
        body: "Sporters en ouders zien per module direct hoe het ervoor staat — zonder rangordes of cijfers.",
      },
      {
        icon: Compass,
        title: "Groei over jaren",
        body: "Bij promotie naar een nieuw team begin je opnieuw, maar de hele geschiedenis blijft zichtbaar.",
      },
    ],
  },
  {
    slug: "gamification",
    href: "/features/gamification",
    title: "Badges, streaks & challenges",
    short:
      "Beloon inzet en consistentie. Geef sporters een reden om elke training het beste te geven.",
    long:
      "Een doordachte gamification-laag motiveert sporters zonder een wedstrijd van groei te maken. Trainers en de club bepalen welke badges beschikbaar zijn, welke streaks meetellen en welke challenges spelen — individueel of als team.",
    icon: Trophy,
    highlights: [
      "Custom badges per club, team of leeftijdsgroep",
      "Streaks voor consistentie en inzet",
      "Individuele en team-challenges",
      "Erkenning per stap, geen ranglijsten",
    ],
    bullets: [
      {
        icon: Award,
        title: "Custom badges",
        body: "Ontwerp eigen badges die passen bij jouw sport en clubcultuur. Trainers kennen ze handmatig of automatisch toe.",
      },
      {
        icon: Flame,
        title: "Streaks",
        body: "Beloon sporters die week na week komen, oefenen of een doel halen. Streaks zien er goed uit op het profiel.",
      },
      {
        icon: HeartHandshake,
        title: "Team-challenges",
        body: "Maak uitdagingen voor het hele team. Samen werken aan een doel versterkt clubgevoel.",
      },
      {
        icon: Sparkles,
        title: "Erkenning, geen ranking",
        body: "NXTTRACK toont vooruitgang en motivatie, niet wie er beter is dan een ander.",
      },
    ],
  },
  {
    slug: "clubfeed",
    href: "/features/clubfeed",
    title: "Veilige clubfeed",
    short:
      "Een sociaal platform binnen jouw club. Gecontroleerd, veilig en betrokken.",
    long:
      "Een eigen clubfeed waar prestaties, mooie momenten en aankondigingen samenkomen. Geen open social media en geen ruis — wel échte betrokkenheid van sporters, ouders en trainers. Trainers modereren, de club bepaalt wie wat mag zien of delen.",
    icon: Rss,
    highlights: [
      "Aparte feeds per team of clubbreed",
      "Reageren en feliciteren door ouders en sporters",
      "Moderatie door trainers en coördinatoren",
      "Gecontroleerde zichtbaarheid van minderjarigen",
    ],
    bullets: [
      {
        icon: MessagesSquare,
        title: "Reacties en likes",
        body: "Ouders feliciteren, teamgenoten reageren — een feed die past bij een vereniging.",
      },
      {
        icon: ShieldCheck,
        title: "Volledige moderatie",
        body: "Trainers verwijderen, dempen of schakelen reacties uit. De club bepaalt de huisregels.",
      },
      {
        icon: Lock,
        title: "Veilig voor minderjarigen",
        body: "Ingebouwde regels voor jongere sporters zorgen dat NXTTRACK voldoet aan moderne privacy-verwachtingen.",
      },
      {
        icon: Bell,
        title: "Coach broadcasts",
        body: "Trainers sturen één bericht naar de hele groep — zichtbaar in de feed én via notificaties.",
      },
    ],
  },
  {
    slug: "ledenbeheer",
    href: "/features/ledenbeheer",
    title: "Ledenbeheer & planning",
    short:
      "Eén overzicht voor leden, contributie, agenda's, aanwezigheid en teams.",
    long:
      "Vervang spreadsheets en losse tools. NXTTRACK biedt volledig ledenbeheer met contributie-overzicht, planning per team en trainer, agenda's, aanwezigheidsregistratie en teamindelingen.",
    icon: Users,
    highlights: [
      "Compleet ledenbeheer met groepen en teams",
      "Contributie-overzicht per lid en per periode",
      "Agenda en planning per team en trainer",
      "Aanwezigheidsregistratie met automatische rapportages",
    ],
    bullets: [
      {
        icon: Users,
        title: "Leden, ouders en kinderen",
        body: "Eén familie-account met meerdere kinderen, gekoppeld aan groepen en teams.",
      },
      {
        icon: Calendar,
        title: "Slimme agenda",
        body: "Trainingen, evenementen, wedstrijden — per team en per trainer overzichtelijk weergegeven.",
      },
      {
        icon: ClipboardList,
        title: "Aanwezigheid",
        body: "Trainers vinken aan wie er was. Rapportages per maand of seizoen worden automatisch gegenereerd.",
      },
      {
        icon: Receipt,
        title: "Contributie-inzicht",
        body: "Zie per lid de openstaande en betaalde contributie. Eenvoudig in beheer voor de penningmeester.",
      },
    ],
  },
  {
    slug: "certificaten",
    href: "/features/certificaten",
    title: "Certificaten & rapportages",
    short:
      "Diploma's, certificaten en aanwezigheidsrapporten — automatisch in jouw clubstijl.",
    long:
      "Genereer diploma's en certificaten automatisch op basis van gehaalde modules. Aanwezigheidsrapporten en voortgangsrapporten verschijnen op één klik in de huisstijl van de club.",
    icon: FileBadge,
    highlights: [
      "Diploma's en certificaten per module of leerlijn",
      "Volledig aanpasbare templates in clubstijl",
      "Aanwezigheidsrapporten per lid of team",
      "Voortgangsrapporten voor ouders en sporters",
    ],
    bullets: [
      {
        icon: FileBadge,
        title: "Custom templates",
        body: "Eigen logo, kleuren en lay-out. Sportscholen, zwemscholen en academies krijgen direct herkenbare diploma's.",
      },
      {
        icon: PieChart,
        title: "Aanwezigheidsrapporten",
        body: "Per lid, per groep of per maand. Direct downloadbaar als PDF of bewaarbaar in het profiel.",
      },
      {
        icon: BarChart3,
        title: "Voortgangsrapporten",
        body: "Een overzicht van behaalde modules en lopende ontwikkeling, klaar om te delen met ouders.",
      },
      {
        icon: GraduationCap,
        title: "Diploma-uitreiking",
        body: "Plan momenten in waarop sporters hun diploma in ontvangst nemen — zichtbaar in de clubfeed.",
      },
    ],
  },
  {
    slug: "communicatie",
    href: "/features/communicatie",
    title: "Communicatie & nieuwsbrieven",
    short:
      "Berichten, notificaties en nieuwsbrieven — allemaal vanuit één platform.",
    long:
      "Direct communiceren met leden, ouders of een specifiek team. Notificaties, e-mailnieuwsbrieven en directe berichten — alles in NXTTRACK, vormgegeven in jouw clubstijl.",
    icon: Mail,
    highlights: [
      "Push- en e-mailnotificaties per gebeurtenis",
      "Custom nieuwsbrieven met TipTap-editor",
      "Directe berichten naar leden en groepen",
      "Inschrijvingen en proeflessen via één link",
    ],
    bullets: [
      {
        icon: Bell,
        title: "Slimme notificaties",
        body: "Per gebeurtenis instelbaar: nieuws, agenda, voortgang of badges. Leden bepalen zelf wat ze willen ontvangen.",
      },
      {
        icon: Mail,
        title: "Nieuwsbrieven",
        body: "Bouw nieuwsbrieven met onze ingebouwde editor. Verstuur naar de hele club, een team of een doelgroep.",
      },
      {
        icon: MessagesSquare,
        title: "Directe berichten",
        body: "Trainers en coördinatoren chatten 1-op-1 of in groepen — zonder buiten het platform te treden.",
      },
      {
        icon: Smartphone,
        title: "Native PWA",
        body: "Volledige Progressive Web App: installeer NXTTRACK als app op iOS en Android zonder app store.",
      },
    ],
  },
];

export interface Sector {
  slug: string;
  href: string;
  title: string;
  short: string;
  hero: string;
  icon: LucideIcon;
  benefits: { icon: LucideIcon; title: string; body: string }[];
  highlights: string[];
}

export const SECTORS: Sector[] = [
  {
    slug: "sportverenigingen",
    href: "/voor-wie/sportverenigingen",
    title: "Sportverenigingen",
    short: "Voor voetbal-, hockey-, korfbal- en andere clubs.",
    hero:
      "Eén platform voor het hele seizoen: van inschrijving en contributie tot training, ontwikkeling en clubgevoel.",
    icon: Footprints,
    highlights: [
      "Teams, trainers en coördinatoren in één overzicht",
      "Voortgang per speler zichtbaar voor ouders",
      "Clubfeed versterkt het verenigingsgevoel",
      "Aanwezigheidsregistratie per training",
    ],
    benefits: [
      {
        icon: Users,
        title: "Teams en groepen",
        body: "Splits leden in teams, groepen of leeftijdscategorieën — pas in NXTTRACK exact toe wat al binnen je club leeft.",
      },
      {
        icon: Calendar,
        title: "Wedstrijden en trainingen",
        body: "Combineer trainingsschema's met wedstrijdkalenders en houd ouders altijd op de hoogte.",
      },
      {
        icon: Trophy,
        title: "Erken individueel én collectief",
        body: "Badges voor individuele groei plus team-challenges die het seizoen tot een doel maken.",
      },
    ],
  },
  {
    slug: "zwemscholen",
    href: "/voor-wie/zwemscholen",
    title: "Zwemscholen",
    short: "Voor diploma-zwemmen, baby- en peuterzwemmen en wedstrijdzwemmen.",
    hero:
      "Houd diplomalijnen, badjes en niveaus eenvoudig bij. Ouders zien direct welk onderdeel hun kind nu oefent.",
    icon: Waves,
    highlights: [
      "Modules per diploma (A, B, C of eigen lijn)",
      "Onderdelen vink je af per training",
      "Diploma's en certificaten in clubstijl",
      "Wachtlijsten en proeflessen via één link",
    ],
    benefits: [
      {
        icon: Target,
        title: "Stap voor stap naar het diploma",
        body: "Iedere zwemslag, sprong en oefening als eigen onderdeel binnen een module — duidelijk wat er nog moet komen.",
      },
      {
        icon: FileBadge,
        title: "Diploma-automatisering",
        body: "Wanneer een leerling alle onderdelen van een module heeft, genereert NXTTRACK het diploma automatisch.",
      },
      {
        icon: HeartHandshake,
        title: "Ouders rustig houden",
        body: "Geen onduidelijke nieuwsbrieven meer — ouders zien zelf de voortgang van hun kind in de app.",
      },
    ],
  },
  {
    slug: "sportscholen",
    href: "/voor-wie/sportscholen",
    title: "Sportscholen",
    short: "Voor fitness-, krachtsport- en gym-locaties.",
    hero:
      "Begeleid leden in hun persoonlijke trainingsdoelen. Communiceer eenvoudig over groepslessen, openingstijden en evenementen.",
    icon: Dumbbell,
    highlights: [
      "Groepslesplanning en deelname-overzicht",
      "Persoonlijke ontwikkelingsroutes per lid",
      "Communicatie via push, mail en feed",
      "Klantbeleving op platform-niveau",
    ],
    benefits: [
      {
        icon: Activity,
        title: "Persoonlijke trainingsplannen",
        body: "Bouw per lid een eigen schema op met modules en oefeningen. Voortgang wordt zichtbaar in het profiel.",
      },
      {
        icon: Calendar,
        title: "Groepslesrooster",
        body: "Plan groepslessen, beheer aanmeldingen en houd zicht op deelname per maand.",
      },
      {
        icon: Bell,
        title: "Houd leden betrokken",
        body: "Notificaties over openingstijden, evenementen en wijzigingen — zonder dat leden de app uit moeten.",
      },
    ],
  },
  {
    slug: "academies",
    href: "/voor-wie/academies",
    title: "Sportacademies",
    short: "Voor talent- en jeugdacademies in elke discipline.",
    hero:
      "Een meetbaar ontwikkelingsmodel voor talenten van jong tot senior. Volg progressie over jaren en seizoenen.",
    icon: GraduationCap,
    highlights: [
      "Meerjarige ontwikkelingscurves per talent",
      "Cross-team rapportages voor scouts en coaches",
      "Geschiedenis bewaard bij doorstroom",
      "Beoordelingen door meerdere coaches",
    ],
    benefits: [
      {
        icon: LineChart,
        title: "Meerjarige progressie",
        body: "Doorstromen naar een ouder team? De geschiedenis blijft, het profiel groeit mee.",
      },
      {
        icon: Shield,
        title: "Vertrouwelijk en veilig",
        body: "Rolgebaseerd toegangsbeheer zorgt dat alleen relevante coaches en scouts data zien.",
      },
      {
        icon: Sparkles,
        title: "Talentherkenning",
        body: "Zie patronen in voortgang en streaks die anders aan de aandacht ontsnappen.",
      },
    ],
  },
  {
    slug: "dansscholen",
    href: "/voor-wie/dansscholen",
    title: "Dans- & vechtsportscholen",
    short: "Voor dansstudio's, karate, judo, taekwondo en aanverwante sporten.",
    hero:
      "Volg techniek, vorderingen en behaalde graden. Maak diploma's, banden en eindshows zichtbaar in één platform.",
    icon: Music,
    highlights: [
      "Banden- en gradensysteem helder vastgelegd",
      "Show-, demo- en examenkalender",
      "Voortgang per techniek of choreografie",
      "Custom diploma's en certificaten",
    ],
    benefits: [
      {
        icon: Sword,
        title: "Banden en graden",
        body: "Modules per band of graad maken examenvoorbereiding voor leerling en docent inzichtelijk.",
      },
      {
        icon: Music,
        title: "Choreografie & techniek",
        body: "Houd per leerling bij welke choreografieën, technieken of stijlen beheerst worden.",
      },
      {
        icon: ImageIcon,
        title: "Show- en examenmomenten",
        body: "Plan examens en eindshows en maak ze tot blikvanger in de clubfeed.",
      },
    ],
  },
];

export interface NavItem {
  label: string;
  href: string;
  description?: string;
  icon?: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  href?: string;
}

export const PRIMARY_NAV: (NavItem | NavGroup)[] = [
  {
    label: "Producten",
    items: FEATURES.map((f) => ({
      label: f.title,
      href: f.href,
      description: f.short,
      icon: f.icon,
    })),
  },
  {
    label: "Voor wie",
    items: [
      ...SECTORS.map((s) => ({
        label: s.title,
        href: s.href,
        description: s.short,
        icon: s.icon,
      })),
      {
        label: "Voor sporters & ouders",
        href: "/voor-sporters",
        description:
          "Hoe NXTTRACK eruit ziet vanuit het perspectief van sporters en ouders.",
        icon: HeartHandshake,
      },
    ],
  },
  { label: "Prijzen", href: "/prijzen" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Over ons", href: "/over-ons" },
];

export const FOOTER_GROUPS: NavGroup[] = [
  {
    label: "Producten",
    items: FEATURES.map((f) => ({ label: f.title, href: f.href })),
  },
  {
    label: "Voor wie",
    items: [
      ...SECTORS.map((s) => ({ label: s.title, href: s.href })),
      { label: "Sporters & ouders", href: "/voor-sporters" },
    ],
  },
  {
    label: "Bedrijf",
    items: [
      { label: "Over ons", href: "/over-ons" },
      { label: "Prijzen", href: "/prijzen" },
      { label: "Roadmap", href: "/roadmap" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export interface RoadmapItem {
  status: "in-ontwikkeling" | "binnenkort" | "gepland" | "ideeën";
  title: string;
  body: string;
  icon: LucideIcon;
}

export const ROADMAP: RoadmapItem[] = [];

export const STATS: { value: string; label: string }[] = [
  { value: "1", label: "Centraal platform" },
  { value: "6", label: "Kernmodules" },
  { value: "24/7", label: "Beschikbaar" },
  { value: "100%", label: "AVG-conform" },
];

export const TRUST_POINTS: { icon: LucideIcon; title: string; body: string }[] =
  [
    {
      icon: ShieldCheck,
      title: "Privacy by design",
      body: "Volledig AVG-conform met rolgebaseerde toegang per tenant.",
    },
    {
      icon: Zap,
      title: "Snelle adoptie",
      body: "Trainers en ouders zijn binnen één training mee — geen handleiding nodig.",
    },
    {
      icon: Settings,
      title: "Aanpasbaar per club",
      body: "Stem leerlijn, stijl en regels af op je eigen verenigingscultuur.",
    },
    {
      icon: Rocket,
      title: "Continu in ontwikkeling",
      body: "Iedere maand nieuwe functies. Stem mee over wat als volgende komt.",
    },
  ];

export const HOW_IT_WORKS: { icon: LucideIcon; step: string; title: string; body: string }[] = [
  {
    icon: HeartHandshake,
    step: "01",
    title: "Kennismaking",
    body: "We bespreken jouw club, sport en wensen in een vrijblijvend gesprek van 30 minuten.",
  },
  {
    icon: Settings,
    step: "02",
    title: "Inrichting",
    body: "Samen zetten we leden, teams en ontwikkelingsmodules op — vaak in een week live.",
  },
  {
    icon: Users,
    step: "03",
    title: "Trainers en ouders aan boord",
    body: "Korte uitleg, persoonlijke onboarding en duidelijke materialen voor je hele club.",
  },
  {
    icon: Sparkles,
    step: "04",
    title: "Doorlopende ondersteuning",
    body: "Vragen, wensen of feedback? Korte lijntjes en updates die er echt toe doen.",
  },
];

export type { LucideIcon };
export { CheckCircle2 };
