import { notFound } from "next/navigation";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getPublicTrainers } from "@/lib/db/homepage";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Sprint 78b — Volledige publieke trainers-pagina voor een tenant.
 * Toont alle publieke trainers in een grid met foto, naam, functietitel
 * en bio. Wordt vanaf de homepage trainers-kaart aangelinkt.
 */
export default async function PublicTrainersPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const trainers = await getPublicTrainers(tenant.id);

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Trainers">
      {trainers.length === 0 ? (
        <PublicCard className="p-6">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Er zijn nog geen trainers gepubliceerd.
          </p>
        </PublicCard>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trainers.map((t) => (
            <PublicCard key={t.id} className="flex flex-col gap-3 p-5 sm:p-6">
              <div className="flex items-center gap-4">
                {t.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.photo_url}
                    alt={t.full_name}
                    loading="lazy"
                    className="h-20 w-20 rounded-full object-cover"
                    style={{ border: "1px solid var(--surface-border)" }}
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full text-lg font-semibold"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--tenant-accent) 18%, transparent)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--surface-border)",
                    }}
                    aria-hidden
                  >
                    {t.full_name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0]!.toUpperCase())
                      .join("") || "?"}
                  </div>
                )}
                <div className="min-w-0">
                  <h2
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                    title={t.full_name}
                  >
                    {t.full_name}
                  </h2>
                  {t.role_label && (
                    <p
                      className="truncate text-xs"
                      style={{ color: "var(--text-secondary)" }}
                      title={t.role_label}
                    >
                      {t.role_label}
                    </p>
                  )}
                </div>
              </div>
              {t.public_bio && (
                <p
                  className="whitespace-pre-line text-xs leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t.public_bio}
                </p>
              )}
            </PublicCard>
          ))}
        </div>
      )}
    </PublicTenantShell>
  );
}
