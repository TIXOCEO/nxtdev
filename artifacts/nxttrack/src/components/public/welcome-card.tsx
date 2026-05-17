import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicCard } from "@/components/public/public-card";
import type { Tenant } from "@/types/database";

interface Props {
  tenant: Pick<Tenant, "name" | "welcome_text" | "welcome_more_url">;
}

/**
 * Sprint 78b — Welkom-kaart voor de publieke tenant-homepage.
 * Toont een vrije welkom-tekst van de tenant + optionele "Lees meer"-CTA.
 * Wordt overgeslagen wanneer er geen tekst is ingesteld.
 */
export function WelcomeCard({ tenant }: Props) {
  const text = (tenant.welcome_text ?? "").trim();
  if (!text) return null;

  const moreUrl = (tenant.welcome_more_url ?? "").trim();

  return (
    <PublicCard className="flex h-full flex-col gap-3 p-5 sm:p-6">
      <h3
        className="text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        Welkom bij {tenant.name}
      </h3>
      <p
        className="whitespace-pre-line text-sm leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {text}
      </p>
      {moreUrl && (
        <div className="mt-auto pt-2">
          <Link
            href={moreUrl}
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: "var(--tenant-accent)" }}
          >
            Lees meer <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </PublicCard>
  );
}
