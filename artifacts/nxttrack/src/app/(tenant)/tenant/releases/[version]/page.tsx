import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { getReleaseByVersion } from "@/lib/db/releases";
import type { ReleaseBody, ReleaseType } from "@/lib/validation/release";

export const dynamic = "force-dynamic";

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

export default async function TenantReleaseDetailPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const release = await getReleaseByVersion(version);
  if (!release) notFound();

  const tone = TYPE_TONE[release.release_type];

  return (
    <>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Link href="/tenant/releases" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar alle releases
        </Link>
      </div>

      <PageHeading title={release.title} description={release.summary} />

      <article
        className="rounded-2xl border p-5"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <header className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: tone.bg, color: tone.fg }}
          >
            {tone.label}
          </span>
          <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
            v{release.version}
          </span>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            · {fmt(release.published_at)}
          </span>
        </header>

        <div className="mt-4 space-y-4">
          {SECTION_ORDER.map((key) => {
            const items = release.body_json[key];
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
    </>
  );
}
