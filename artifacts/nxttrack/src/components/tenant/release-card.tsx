import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import type { PlatformRelease } from "@/lib/db/releases";
import type { ReleaseType } from "@/lib/validation/release";

const TYPE_TONE: Record<ReleaseType, { bg: string; fg: string; label: string }> = {
  major: { bg: "#1e293b", fg: "#ffffff", label: "Major" },
  minor: { bg: "#dbeafe", fg: "#1e40af", label: "Minor" },
  patch: { bg: "#dcfce7", fg: "#166534", label: "Patch" },
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Vaste "Laatste update"-container op het tenant-dashboard.
 * Niet weg te klikken of te verwijderen door een tenant-admin —
 * onderdeel van de vaste dashboard-layout.
 */
export function LatestReleaseCard({ release }: { release: PlatformRelease | null }) {
  return (
    <section
      className="rounded-2xl border p-5"
      style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--surface-soft)", color: "var(--text-secondary)" }}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              Laatste update
            </p>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {release ? release.title : "Nog geen release gepubliceerd"}
            </p>
          </div>
        </div>
        <Link
          href="/tenant/releases"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
          style={{ color: "var(--text-secondary)" }}
        >
          Alle releases <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {release ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: TYPE_TONE[release.release_type].bg, color: TYPE_TONE[release.release_type].fg }}
            >
              {TYPE_TONE[release.release_type].label}
            </span>
            <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
              v{release.version}
            </span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              · {fmt(release.published_at)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
            {release.summary}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          Zodra het platform-team een release publiceert, zie je die hier terug.
        </p>
      )}
    </section>
  );
}
