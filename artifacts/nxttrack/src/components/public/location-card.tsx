import { MapPin, ExternalLink } from "lucide-react";
import { PublicCard } from "@/components/public/public-card";
import type { Tenant } from "@/types/database";

interface Props {
  tenant: Pick<
    Tenant,
    | "location_name"
    | "address_line1"
    | "postal_code"
    | "city"
    | "country"
    | "latitude"
    | "longitude"
  >;
}

/**
 * Sprint 78b — Locatie-kaart voor de publieke tenant-homepage.
 * Toont adresgegevens + een Google Maps deeplink. Wordt overgeslagen
 * wanneer er geen locatie-informatie is ingesteld.
 */
export function LocationCard({ tenant }: Props) {
  const hasAddress = Boolean(
    tenant.location_name ||
      tenant.address_line1 ||
      tenant.postal_code ||
      tenant.city,
  );
  const hasCoords =
    typeof tenant.latitude === "number" &&
    typeof tenant.longitude === "number";

  if (!hasAddress && !hasCoords) return null;

  // Maps-URL: prefer exacte coördinaten, anders het adres als query.
  const mapsQuery = hasCoords
    ? `${tenant.latitude},${tenant.longitude}`
    : [
        tenant.address_line1,
        [tenant.postal_code, tenant.city].filter(Boolean).join(" "),
        tenant.country,
      ]
        .filter(Boolean)
        .join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;

  const cityLine = [tenant.postal_code, tenant.city].filter(Boolean).join(" ");

  return (
    <PublicCard className="flex h-full flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--tenant-accent) 22%, transparent)",
            color: "var(--text-primary)",
          }}
          aria-hidden
        >
          <MapPin className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {tenant.location_name || "Onze locatie"}
          </h3>
          <address
            className="mt-1 not-italic text-xs leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {tenant.address_line1 && <div>{tenant.address_line1}</div>}
            {cityLine && <div>{cityLine}</div>}
            {tenant.country && <div>{tenant.country}</div>}
          </address>
        </div>
      </div>
      <div className="mt-auto pt-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--tenant-accent)" }}
        >
          Bekijk op Google Maps <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </PublicCard>
  );
}
