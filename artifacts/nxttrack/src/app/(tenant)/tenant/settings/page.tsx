import Link from "next/link";
import {
  BellRing,
  CalendarDays,
  ChevronRight,
  CreditCard,
  ImageIcon,
  Mail,
  Palette,
  Rss,
  Search,
  Settings,
  Share2,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  TenantAdminHero,
  TenantAdminSectionHeader,
  TenantAdminSurface,
} from "@/components/tenant/tenant-backoffice-components";

export const dynamic = "force-dynamic";

const GROUPS: Array<{
  title: string;
  description: string;
  items: Array<{
    href: string;
    icon: LucideIcon;
    title: string;
    description: string;
  }>;
}> = [
  {
    title: "Identiteit en merk",
    description: "Hoe de tenant eruitziet op publieke pagina's en in het ledenportaal.",
    items: [
      {
        href: "/tenant/settings/themes",
        icon: Palette,
        title: "Thema's",
        description: "Activeer light- en dark-thema's en beheer kleurenschema's.",
      },
      {
        href: "/tenant/settings/profile-pictures",
        icon: ImageIcon,
        title: "Profielafbeeldingen",
        description: "Templates en standaard profielfoto voor leden.",
      },
      {
        href: "/tenant/settings/seo",
        icon: Search,
        title: "SEO",
        description: "Titels, omschrijvingen en deelafbeeldingen voor zoekmachines.",
      },
    ],
  },
  {
    title: "Communicatie",
    description: "Alle kanalen waarmee leden, ouders en trainers berichten ontvangen.",
    items: [
      {
        href: "/tenant/settings/email",
        icon: Mail,
        title: "E-mail",
        description: "Afzendernaam, uitnodigingen, herinneringen en cooldowns.",
      },
      {
        href: "/tenant/settings/push",
        icon: BellRing,
        title: "Pushmeldingen",
        description: "Bepaal welke events pushberichten versturen.",
      },
      {
        href: "/tenant/settings/social",
        icon: Share2,
        title: "Social media",
        description: "Beheer actieve social kanalen en publieke URL's.",
      },
      {
        href: "/tenant/settings/social-feed",
        icon: Rss,
        title: "Social feed",
        description: "Zet community-feed onderdelen aan of uit.",
      },
    ],
  },
  {
    title: "Operatie",
    description: "Standaarden voor lessen, intake en betalingen.",
    items: [
      {
        href: "/tenant/settings/training",
        icon: CalendarDays,
        title: "Trainingen",
        description: "Herinneringen en cutoff voor late wijzigingen.",
      },
      {
        href: "/tenant/settings/betaalmogelijkheden",
        icon: CreditCard,
        title: "Betaalmogelijkheden",
        description: "Betaalmethoden die leden kunnen kiezen.",
      },
      {
        href: "/tenant/settings/intake",
        icon: Settings,
        title: "Intake",
        description: "Instellingen voor publieke intake en slotvoorstellen.",
      },
    ],
  },
  {
    title: "Toegang en veiligheid",
    description: "Wie mag beheren, publiceren en gevoelige data bekijken.",
    items: [
      {
        href: "/tenant/settings/roles",
        icon: ShieldCheck,
        title: "Rollen & permissies",
        description: "Eigen rollen en permissies per onderdeel.",
      },
    ],
  },
];

export default function TenantSettingsIndex() {
  return (
    <>
      <TenantAdminHero
        eyebrow="Configuratie"
        title="Instellingen"
        description="Alle tenant-instellingen logisch gegroepeerd. Begin bij merk en communicatie, daarna operatie, toegang en veiligheid."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {GROUPS.map((group) => (
          <TenantAdminSurface key={group.title} className="p-4 sm:p-5">
            <TenantAdminSectionHeader
              title={group.title}
              description={group.description}
            />
            <div className="mt-4 grid gap-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nxt-focus-ring flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-black/5"
                    style={{
                      borderColor: "var(--shell-border)",
                      backgroundColor: "var(--shell-panel-muted)",
                    }}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--tenant-accent, var(--accent)) 14%, #ffffff)",
                        color: "var(--brand-navy)",
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                        {item.description}
                      </span>
                    </span>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
                  </Link>
                );
              })}
            </div>
          </TenantAdminSurface>
        ))}
      </div>
    </>
  );
}
