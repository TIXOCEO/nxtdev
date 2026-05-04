import Link from "next/link";
import { ArrowRight, AlertTriangle, Newspaper, Mail, Bell } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";

export const dynamic = "force-dynamic";

const TILES = [
  {
    href: "/tenant/news",
    title: "Nieuws",
    description: "Publiceer nieuwsberichten voor leden en bezoekers.",
    icon: Newspaper,
  },
  {
    href: "/tenant/communication/alerts",
    title: "Alerts & aankondigingen",
    description: "Belangrijke meldingen op de homepage.",
    icon: AlertTriangle,
  },
  {
    href: "/tenant/notifications",
    title: "Meldingen",
    description: "Versturen van handmatige push- en in-app meldingen.",
    icon: Bell,
  },
  {
    href: "/tenant/email-templates",
    title: "E-mail templates",
    description: "Beheer transactionele e-mail templates.",
    icon: Mail,
  },
];

export default function TenantCommunicationHubPage() {
  return (
    <>
      <PageHeading
        title="Communicatie"
        description="Beheer alle communicatiekanalen op één plek."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex items-start gap-3 rounded-[var(--radius-nxt-lg)] border p-4 transition-shadow hover:shadow-md"
            style={{
              backgroundColor: "var(--surface-main)",
              borderColor: "var(--surface-border)",
              boxShadow: "var(--shadow-app)",
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              <t.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {t.title}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t.description}
              </p>
            </div>
            <ArrowRight
              className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
              style={{ color: "var(--text-secondary)" }}
            />
          </Link>
        ))}
      </div>
    </>
  );
}
