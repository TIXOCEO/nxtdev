import Link from "next/link";
import {
  Mail,
  CalendarDays,
  ImageIcon,
  BellRing,
  ChevronRight,
  Palette,
  Search,
  ShieldCheck,
  Share2,
  Rss,
} from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    href: "/tenant/settings/email",
    icon: Mail,
    title: "E-mail",
    description: "Afzendernaam, herinnering- en cooldown-instellingen voor uitnodigingen.",
  },
  {
    href: "/tenant/settings/training",
    icon: CalendarDays,
    title: "Trainingen",
    description: "Standaard herinneringen en cutoff voor late wijzigingen.",
  },
  {
    href: "/tenant/settings/profile-pictures",
    icon: ImageIcon,
    title: "Profielafbeeldingen",
    description: "Eigen templates en standaard profielfoto voor leden.",
  },
  {
    href: "/tenant/settings/push",
    icon: BellRing,
    title: "Pushmeldingen",
    description: "Schakel pushmeldingen in en bepaal welke events er pushen.",
  },
  {
    href: "/tenant/settings/themes",
    icon: Palette,
    title: "Thema's",
    description: "Activeer light- en dark-thema's en beheer eigen kleurenschema's.",
  },
  {
    href: "/tenant/settings/seo",
    icon: Search,
    title: "SEO",
    description: "Standaard titel, omschrijving en deelafbeelding voor zoekmachines en sociale media.",
  },
  {
    href: "/tenant/settings/roles",
    icon: ShieldCheck,
    title: "Rollen & permissies",
    description: "Maak eigen rollen en geef leden gerichte permissies, gegroepeerd per onderdeel.",
  },
  {
    href: "/tenant/settings/social",
    icon: Share2,
    title: "Social media",
    description: "Vul de URLs van je social kanalen in en zet de actieve kanalen aan.",
  },
  {
    href: "/tenant/settings/social-feed",
    icon: Rss,
    title: "Social feed",
    description: "Bepaal welke onderdelen van de community-feed actief zijn.",
  },
];

export default function TenantSettingsIndex() {
  return (
    <>
      <PageHeading
        title="Instellingen"
        description="Pas e-mail, trainingen, thema's en SEO aan voor jouw club."
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex items-start gap-3 rounded-2xl border p-4 transition-colors hover:bg-black/5"
              style={{
                backgroundColor: "var(--surface-main)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "var(--surface-soft)" }}
              >
                <s.icon className="h-5 w-5" style={{ color: "var(--text-primary)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {s.title}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {s.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
