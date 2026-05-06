"use client";

import { useMemo, useState } from "react";
import type { PlatformRelease } from "@/lib/db/releases";
import type { ReleaseBody, ReleaseType } from "@/lib/validation/release";
import { cn } from "@/lib/utils";

const TYPE_TONE: Record<ReleaseType, { bg: string; fg: string; label: string }> = {
  major: { bg: "#1e293b", fg: "#ffffff", label: "Major" },
  minor: { bg: "#dbeafe", fg: "#1e40af", label: "Minor" },
  patch: { bg: "#dcfce7", fg: "#166534", label: "Patch" },
};

const SECTION_LABEL: Record<keyof ReleaseBody, string> = {
  new: "Nieuw",
  improved: "Verbeterd",
  fixed: "Opgelost",
  admin: "Voor admins",
};

const SECTION_ORDER: (keyof ReleaseBody)[] = ["new", "improved", "fixed", "admin"];

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const FILTERS: { value: "all" | ReleaseType; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "patch", label: "Patch" },
];

export function ReleasesArchive({ releases }: { releases: PlatformRelease[] }) {
  const [filter, setFilter] = useState<"all" | ReleaseType>("all");
  const filtered = useMemo(
    () => (filter === "all" ? releases : releases.filter((r) => r.release_type === filter)),
    [filter, releases],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.value ? "shadow-sm" : "hover:bg-black/5",
            )}
            style={
              filter === f.value
                ? { backgroundColor: "var(--accent)", color: "var(--text-primary)", borderColor: "transparent" }
                : { borderColor: "var(--surface-border)", color: "var(--text-secondary)" }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((r) => (
          <article
            key={r.id}
            className="rounded-2xl border p-5"
            style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
          >
            <header className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: TYPE_TONE[r.release_type].bg, color: TYPE_TONE[r.release_type].fg }}
              >
                {TYPE_TONE[r.release_type].label}
              </span>
              <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                v{r.version}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                · {fmt(r.published_at)}
              </span>
            </header>
            <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {r.title}
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              {r.summary}
            </p>

            <div className="mt-4 space-y-3">
              {SECTION_ORDER.map((key) => {
                const items = r.body_json[key];
                if (!items || items.length === 0) return null;
                return (
                  <div key={key}>
                    <p
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {SECTION_LABEL[key]}
                    </p>
                    <ul
                      className="mt-1 list-disc space-y-1 pl-5 text-sm"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {items.map((it, i) => (
                        <li key={i}>{it}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
