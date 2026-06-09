import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { PlatformRelease } from "@/lib/db/releases";
import type { ReleaseType } from "@/lib/validation/release";

const TYPE_TONE: Record<ReleaseType, { bg: string; fg: string; label: string }> = {
  major: { bg: "#1e293b", fg: "#ffffff", label: "Major" },
  minor: { bg: "#dbeafe", fg: "#1e40af", label: "Minor" },
  patch: { bg: "#dcfce7", fg: "#166534", label: "Patch" },
};

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function LatestReleaseCard({
  release,
  isUnseen = false,
}: {
  release: PlatformRelease | null;
  isUnseen?: boolean;
}) {
  return (
    <section className="nxt-shell-hover nxt-shell-surface rounded-[20px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
            style={{
              borderColor: "var(--shell-border)",
              backgroundColor:
                "color-mix(in srgb, var(--tenant-accent, var(--accent)) 12%, var(--shell-panel-muted))",
              color: "var(--shell-info)",
            }}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                Laatste update
              </p>
              {release && isUnseen ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--shell-danger) 12%, var(--shell-panel-muted))",
                    color: "var(--shell-danger)",
                  }}
                  aria-label="Nieuwe release, nog niet gelezen"
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--shell-danger)" }} />
                  Nieuw
                </span>
              ) : null}
            </div>
            <p className="truncate text-sm font-black" style={{ color: "var(--text-primary)" }}>
              {release ? release.title : "Nog geen release gepubliceerd"}
            </p>
          </div>
        </div>
        <Link
          href={release ? `/tenant/releases/${release.version}` : "/tenant/releases"}
          className="nxt-focus-ring nxt-shell-soft-button inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-bold"
        >
          {release ? "Bekijk" : "Alle"} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {release ? (
        <Link href={`/tenant/releases/${release.version}`} className="mt-4 block rounded-2xl border p-3 transition hover:-translate-y-0.5" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-black"
              style={{ backgroundColor: TYPE_TONE[release.release_type].bg, color: TYPE_TONE[release.release_type].fg }}
            >
              {TYPE_TONE[release.release_type].label}
            </span>
            <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
              v{release.version}
            </span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              - {fmt(release.published_at)}
            </span>
          </div>
          <p className="mt-2 max-h-16 overflow-hidden text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
            {release.summary}
          </p>
        </Link>
      ) : (
        <p className="mt-4 rounded-2xl border p-3 text-sm" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)", color: "var(--text-secondary)" }}>
          Zodra het platform-team een release publiceert, zie je die hier terug.
        </p>
      )}
    </section>
  );
}
