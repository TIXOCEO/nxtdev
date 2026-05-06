import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublishedReleases, markReleaseSeen } from "@/lib/db/releases";
import { requireAuth } from "@/lib/auth/require-auth";
import { ReleasesArchive } from "./_releases-archive";

export const dynamic = "force-dynamic";

export default async function TenantReleasesPage() {
  const [releases, user] = await Promise.all([
    getPublishedReleases(),
    requireAuth(),
  ]);

  // Bezoek aan het archief telt als "ik heb de laatste release gezien".
  if (releases[0]) {
    await markReleaseSeen(user.id, releases[0].version).catch(() => undefined);
  }

  return (
    <>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Link href="/tenant" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar dashboard
        </Link>
      </div>

      <PageHeading
        title="Wat is er nieuw?"
        description="Alle releases van NXTTRACK, nieuwste eerst."
      />

      {releases.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nog geen releases"
          description="Zodra er een release is gepubliceerd zie je die hier terug."
        />
      ) : (
        <ReleasesArchive releases={releases} />
      )}
    </>
  );
}
