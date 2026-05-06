import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { ReleaseForm } from "../_release-form";

export default function NewReleasePage() {
  return (
    <>
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Link href="/platform/releases" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Terug naar releases
        </Link>
      </div>

      <PageHeading
        title="Nieuwe release"
        description="Vul het standaardformat in. Versie moet uniek zijn (semver)."
      />

      <div
        className="rounded-2xl border p-6"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <ReleaseForm mode="create" />
      </div>
    </>
  );
}
