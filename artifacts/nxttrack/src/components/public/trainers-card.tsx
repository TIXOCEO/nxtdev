import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { PublicCard } from "@/components/public/public-card";
import type { PublicTrainer } from "@/types/database";

interface Props {
  trainers: PublicTrainer[];
  tenantSlug: string;
}

/**
 * Sprint 78b — Trainers-kaart voor de publieke tenant-homepage.
 * Toont (tot) 3 trainers met foto, naam en functietitel. Klik door naar
 * de volledige `/t/[slug]/trainers`-pagina voor de hele lijst.
 */
export function TrainersCard({ trainers, tenantSlug }: Props) {
  if (trainers.length === 0) return null;

  return (
    <PublicCard className="flex h-full flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--tenant-accent) 22%, transparent)",
              color: "var(--text-primary)",
            }}
            aria-hidden
          >
            <Users className="h-5 w-5" />
          </div>
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Onze trainers
          </h3>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {trainers.map((t) => (
          <li key={t.id} className="flex flex-col items-center gap-2 text-center">
            <TrainerAvatar
              src={t.photo_url ?? null}
              name={t.full_name}
            />
            <div className="min-w-0">
              <div
                className="truncate text-xs font-semibold"
                style={{ color: "var(--text-primary)" }}
                title={t.full_name}
              >
                {t.full_name}
              </div>
              {t.role_label && (
                <div
                  className="truncate text-[11px]"
                  style={{ color: "var(--text-secondary)" }}
                  title={t.role_label}
                >
                  {t.role_label}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        <Link
          href={`/t/${tenantSlug}/trainers`}
          className="inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--tenant-accent)" }}
        >
          Bekijk alle trainers <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </PublicCard>
  );
}

function TrainerAvatar({ src, name }: { src: string | null; name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        loading="lazy"
        className="h-16 w-16 rounded-full object-cover"
        style={{
          border: "1px solid var(--surface-border)",
        }}
      />
    );
  }
  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-full text-sm font-semibold"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--tenant-accent) 18%, transparent)",
        color: "var(--text-primary)",
        border: "1px solid var(--surface-border)",
      }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}
