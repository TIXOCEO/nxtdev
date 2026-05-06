import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { getReleaseById } from "@/lib/db/releases";
import { ReleaseForm } from "../_release-form";

export const dynamic = "force-dynamic";

export default async function EditReleasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const release = await getReleaseById(id);
  if (!release) notFound();

  return (
    <>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Link href="/platform/releases" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar releases
        </Link>
      </div>

      <PageHeading
        title={`Release v${release.version}`}
        description={release.title}
      />

      <div
        className="rounded-2xl border p-6"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <ReleaseForm mode="edit" initial={release} />
      </div>
    </>
  );
}
