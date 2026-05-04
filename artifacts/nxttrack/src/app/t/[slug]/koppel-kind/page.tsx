import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { LinkMinorByCodeForm } from "./_link-by-code-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function KoppelKindPage({ params }: PageProps) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, slug, primary_color")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) notFound();

  const accent = (tenant.primary_color as string | null) || "#0e3060";

  return (
    <div
      className="min-h-screen px-4 py-10"
      style={{ backgroundColor: "var(--bg-page)" }}
    >
      <div className="mx-auto max-w-md">
        <p
          className="mb-1 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-secondary)" }}
        >
          {tenant.name}
        </p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Koppel je kind
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Vul de koppelcode in die je van de club hebt gekregen.
        </p>

        <div
          className="mt-6 rounded-2xl border p-5 sm:p-6"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <LinkMinorByCodeForm
            tenantId={tenant.id as string}
            tenantSlug={slug}
            accentColor={accent}
          />
        </div>

        <p
          className="mt-4 text-center text-[11px]"
          style={{ color: "var(--text-secondary)" }}
        >
          <Link href={`/t/${slug}`} className="hover:underline">
            ← Terug naar de website van {tenant.name}
          </Link>
        </p>
      </div>
    </div>
  );
}
