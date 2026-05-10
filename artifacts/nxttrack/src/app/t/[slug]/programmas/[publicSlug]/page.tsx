import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { getTenantSeoSettings, getPageSeo } from "@/lib/db/tenant-seo";
import { composeMetadata } from "@/lib/seo/build-metadata";
import { getPublicProgramBySlug } from "@/lib/db/programs-public";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";

interface PageProps {
  params: Promise<{ slug: string; publicSlug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, publicSlug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) return { title: "NXTTRACK" };
  const program = await getPublicProgramBySlug(tenant.id, publicSlug);
  if (!program) return { title: `${tenant.name} | Programma's` };
  const [seo, override] = await Promise.all([
    getTenantSeoSettings(tenant.id),
    getPageSeo(tenant.id, `programmas/${publicSlug}`),
  ]);
  return composeMetadata(tenant, seo, override, {
    title: program.marketing_title || program.name,
    description: program.marketing_description ?? undefined,
  });
}

function ageRangeLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} jaar`;
  if (min != null) return `vanaf ${min} jaar`;
  return `tot ${max} jaar`;
}

export default async function PublicProgramDetailPage({ params }: PageProps) {
  const { slug, publicSlug } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();
  const program = await getPublicProgramBySlug(tenant.id, publicSlug);
  if (!program) notFound();

  const title = program.marketing_title || program.name;
  const age = ageRangeLabel(program.age_min, program.age_max);
  const ctaLabel = program.cta_label || "Inschrijven";

  return (
    <PublicTenantShell tenant={tenant} pageTitle={title} active="programmas">
      <div>
        <Link
          href={`/t/${tenant.slug}/programmas`}
          className="inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Alle programma&apos;s
        </Link>
      </div>

      <PublicCard className="overflow-hidden p-0">
        {program.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={program.hero_image_url}
            alt=""
            className="h-56 w-full object-cover sm:h-72"
          />
        )}
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <h2
              className="text-xl font-semibold sm:text-2xl"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </h2>
            {age && (
              <p
                className="mt-1 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-secondary)" }}
              >
                {age}
              </p>
            )}
          </div>

          {program.marketing_description && (
            <p
              className="whitespace-pre-wrap text-sm leading-6"
              style={{ color: "var(--text-secondary)" }}
            >
              {program.marketing_description}
            </p>
          )}

          {program.highlights_json.length > 0 && (
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-secondary)" }}
              >
                Wat je krijgt
              </p>
              <ul className="mt-2 space-y-1.5">
                {program.highlights_json.map((h, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <span
                      className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: "var(--tenant-accent)" }}
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Link
              href={`/t/${tenant.slug}/inschrijven?program=${encodeURIComponent(program.public_slug)}`}
              className="inline-flex items-center gap-2 rounded-[var(--radius-nxt-md)] px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: "var(--tenant-accent)",
                color: "var(--text-on-accent, #1f2937)",
              }}
              data-testid="program-cta"
            >
              <ClipboardList className="h-4 w-4" /> {ctaLabel}
            </Link>
          </div>
        </div>
      </PublicCard>
    </PublicTenantShell>
  );
}
