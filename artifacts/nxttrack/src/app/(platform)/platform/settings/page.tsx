import Link from "next/link";
import {
  BellRing,
  Mail,
  ImageIcon,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export const dynamic = "force-dynamic";

interface SettingsCard {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const CARDS: SettingsCard[] = [
  {
    href: "/platform/settings/admins",
    label: "Platformbeheerders",
    description: "Bekijk wie platformbeheerder is en voeg nieuwe beheerders toe op e-mailadres.",
    icon: ShieldCheck,
  },
  {
    href: "/platform/push",
    label: "Pushmeldingen",
    description: "VAPID-sleutels, sender en welke event-types via web-push mogen.",
    icon: BellRing,
  },
  {
    href: "/platform/email",
    label: "E-mail",
    description: "Provider-status (SendGrid) en domeinverificatie per tenant.",
    icon: Mail,
  },
  {
    href: "/platform/profile-pictures",
    label: "Profielafbeeldingen",
    description: "Beheer geüploade profielfoto's en moderatie-instellingen.",
    icon: ImageIcon,
  },
];

export default async function PlatformSettingsPage() {
  await requirePlatformAdmin();

  return (
    <>
      <PageHeading
        title="Platforminstellingen"
        description="Configureer platform-brede instellingen en beheer wie toegang heeft."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex items-start gap-4 rounded-2xl border p-4 transition-colors hover:bg-black/5 sm:p-5"
            style={{
              backgroundColor: "var(--surface-main)",
              borderColor: "var(--surface-border)",
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <c.icon className="h-5 w-5" style={{ color: "var(--text-primary)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {c.label}
              </p>
              <p
                className="mt-0.5 text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {c.description}
              </p>
            </div>
            <ChevronRight
              className="h-4 w-4 shrink-0 self-center transition-transform group-hover:translate-x-0.5"
              style={{ color: "var(--text-secondary)" }}
            />
          </Link>
        ))}
      </div>
    </>
  );
}
