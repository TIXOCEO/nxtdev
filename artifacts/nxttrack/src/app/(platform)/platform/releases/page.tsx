import Link from "next/link";
import { Plus, Pencil, Sparkles } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { getAllReleases } from "@/lib/db/releases";
import type { ReleaseStatus, ReleaseType } from "@/lib/validation/release";

export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const TYPE_LABEL: Record<ReleaseType, string> = {
  major: "Major",
  minor: "Minor",
  patch: "Patch",
};

const STATUS_LABEL: Record<ReleaseStatus, string> = {
  draft: "Concept",
  published: "Gepubliceerd",
  archived: "Gearchiveerd",
};

const STATUS_TONE: Record<ReleaseStatus, string> = {
  draft: "var(--text-secondary)",
  published: "#15803d",
  archived: "#9ca3af",
};

export default async function PlatformReleasesPage() {
  const releases = await getAllReleases();

  return (
    <>
      <PageHeading
        title="Releases"
        description="Beheer release notes voor alle tenants."
        actions={
          <Link
            href="/platform/releases/new"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Plus className="h-4 w-4" /> Nieuwe release
          </Link>
        }
      />

      {releases.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nog geen releases"
          description="Maak je eerste release-entry aan."
          action={
            <Link
              href="/platform/releases/new"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              <Plus className="h-4 w-4" /> Nieuwe release
            </Link>
          }
        />
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "var(--surface-soft)", color: "var(--text-secondary)" }}>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                  <th className="px-5 py-3">Versie</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Titel</th>
                  <th className="px-5 py-3">Datum</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
                {releases.map((r) => (
                  <tr key={r.id} style={{ color: "var(--text-primary)" }}>
                    <td className="px-5 py-3 font-mono text-xs">v{r.version}</td>
                    <td className="px-5 py-3 text-xs">{TYPE_LABEL[r.release_type]}</td>
                    <td className="px-5 py-3">{r.title}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {fmt(r.published_at)}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: STATUS_TONE[r.status] }}>
                      {STATUS_LABEL[r.status]}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/platform/releases/${r.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Bewerk
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
