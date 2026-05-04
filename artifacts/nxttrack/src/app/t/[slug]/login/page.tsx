import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { TenantLoginForm } from "./_form";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function TenantLoginPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const accent = /^#[0-9a-fA-F]{6}$/.test(tenant.primary_color)
    ? tenant.primary_color
    : "#b6d83b";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{
        ["--tenant-accent" as string]: accent,
        background:
          "linear-gradient(135deg, var(--bg-viewport-start), var(--bg-viewport-end))",
      } as React.CSSProperties}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-6 rounded-2xl p-8"
        style={{
          backgroundColor: "var(--bg-app)",
          boxShadow: "0 8px 40px var(--shadow-color)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border"
            style={{
              borderColor: "var(--surface-border)",
              backgroundColor: "var(--surface-main)",
            }}
          >
            {tenant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <span
                className="text-lg font-bold"
                style={{ color: "var(--tenant-accent)" }}
              >
                {tenant.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-center">
            <h1
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Inloggen bij {tenant.name}
            </h1>
            <p
              className="mt-0.5 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Gebruik je e-mail en wachtwoord.
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <TenantLoginForm slug={slug} />
        </Suspense>

        <div className="flex flex-col gap-2 text-center text-xs">
          <Link
            href={`/t/${slug}`}
            className="inline-flex items-center justify-center gap-1.5 hover:underline"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft className="h-3 w-3" /> Doorgaan zonder inloggen
          </Link>
        </div>
      </div>
    </div>
  );
}
