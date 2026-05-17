import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { PublicCard } from "./public-card";
import type { TenantEvent } from "@/lib/db/tenant-events";

interface FeaturedEventCardProps {
  event: TenantEvent;
}

function fmtDate(iso: string | null): { day: string; month: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("nl-NL", { day: "2-digit" }),
    month: d.toLocaleDateString("nl-NL", { month: "short" }).toUpperCase(),
  };
}

export function FeaturedEventCard({ event }: FeaturedEventCardProps) {
  const date = fmtDate(event.starts_at);
  const hasCta = !!event.cta_label && !!event.cta_url;

  return (
    <PublicCard className="flex h-full flex-col overflow-hidden">
      {event.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.cover_image_url}
          alt=""
          className="h-32 w-full object-cover"
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          {date ? (
            <div
              className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl"
              style={{
                backgroundColor: "var(--brand-navy, #102544)",
                color: "#fff",
              }}
            >
              <span className="text-lg font-bold leading-none">{date.day}</span>
              <span className="text-[10px] font-semibold tracking-wider opacity-90">
                {date.month}
              </span>
            </div>
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--tenant-accent) 22%, transparent)",
                color: "var(--text-primary)",
              }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{ color: "var(--text-secondary)", opacity: 0.7 }}
            >
              Uitgelicht event
            </p>
            <h3
              className="line-clamp-2 text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {event.title}
            </h3>
          </div>
        </div>
        {event.body && (
          <p
            className="line-clamp-3 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {event.body}
          </p>
        )}
        {hasCta && (
          <div className="mt-auto pt-2">
            <Link
              href={event.cta_url!}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                backgroundColor: "var(--tenant-accent)",
                color: "var(--text-primary)",
              }}
            >
              {event.cta_label} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </PublicCard>
  );
}
