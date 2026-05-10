import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Layers, ArrowRight } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getTenantSeoSettings, getPageSeo } from "@/lib/db/tenant-seo";
import { composeMetadata } from "@/lib/seo/build-metadata";
import { listPublicMarketplacePrograms } from "@/lib/db/programs-public";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  const [seo, override] = await Promise.all([
    getTenantSeoSettings(tenant.id),
    getPageSeo(tenant.id, "programmas"),
  ]);
  return composeMetadata(tenant, seo, override, { title: "Programma's" });
}

function ageRangeLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} jaar`;
  if (min != null) return `vanaf ${min} jaar`;
  return `tot ${max} jaar`;
}

export default async function PublicProgramsPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const programs = await listPublicMarketplacePrograms(tenant.id);

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Programma's" active="programmas">
      <PublicCard className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "color-mix(in srgb, var(--tenant-accent) 22%, transparent)",
              color: "var(--text-primary)",
            }}
          >
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Programma&apos;s
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Ontdek de programma&apos;s van {tenant.name}. Kies het programma dat
              bij je past en schrijf je direct in.
            </p>
          </div>
        </div>
      </PublicCard>

      {programs.length === 0 ? (
        <PublicCard className="p-6 text-center" data-testid="programs-empty-state">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Er zijn op dit moment geen openbare programma&apos;s beschikbaar bij{" "}
            {tenant.name}.
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Heb je een vraag of wil je je aanmelden? Gebruik dan onderstaande
            mogelijkheden om in contact te komen.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={`/t/${tenant.slug}/inschrijven`}
              className="inline-flex items-center gap-2 rounded-[var(--radius-nxt-md)] px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: "var(--tenant-accent)",
                color: "var(--text-on-accent, #1f2937)",
              }}
            >
              Inschrijven
            </Link>
            <Link
              href={`/t/${tenant.slug}/proefles`}
              className="inline-flex items-center gap-2 rounded-[var(--radius-nxt-md)] border px-4 py-2 text-sm font-semibold"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            >
              Proefles aanvragen
            </Link>
          </div>
        </PublicCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {programs.map((p) => {
            const title = p.marketing_title || p.name;
            const age = ageRangeLabel(p.age_min, p.age_max);
            return (
              <Link
                key={p.id}
                href={`/t/${tenant.slug}/programmas/${p.public_slug}`}
                className="group block overflow-hidden rounded-[var(--radius-nxt-lg)] border transition hover:shadow-md"
                style={{
                  borderColor: "var(--surface-border)",
                  backgroundColor: "var(--surface-main)",
                }}
              >
                {p.hero_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.hero_image_url}
                    alt=""
                    className="h-40 w-full object-cover"
                  />
                )}
                <div className="p-4">
                  <h3
                    className="text-base font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {title}
                  </h3>
                  {age && (
                    <p
                      className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {age}
                    </p>
                  )}
                  {p.marketing_description && (
                    <p
                      className="mt-2 line-clamp-3 text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {p.marketing_description}
                    </p>
                  )}
                  <span
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold transition group-hover:gap-2"
                    style={{ color: "var(--tenant-accent)" }}
                  >
                    Meer info <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PublicTenantShell>
  );
}
