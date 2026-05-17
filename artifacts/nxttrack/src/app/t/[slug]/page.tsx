import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarPlus, ClipboardList } from "lucide-react";
import { getPublicTenantHomeData } from "@/lib/db/public-tenant";
import { getPublicHomepageData, getMediaWallItems } from "@/lib/db/homepage";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import { PublicHeroSlider } from "@/components/public/public-hero-slider";
import { TodayBlock } from "@/components/public/today-block";
import { ModuleGrid } from "@/components/homepage/module-grid";
import { NewsListCard } from "@/components/public/news-list-card";
import { FeaturedPhotosCard } from "@/components/public/featured-photos-card";
import { getUser } from "@/lib/auth/get-user";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function PublicHomePage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getUser();

  // Sprint 18: Modular homepage CMS — fetch tenant + configured modules.
  const cms = await getPublicHomepageData(slug, !!user);
  if (!cms) notFound();

  if (cms.modules.length > 0) {
    return (
      <PublicTenantShell
        tenant={cms.tenant}
        pageTitle={`Welkom bij ${cms.tenant.name}`}
        active="home"
      >
        <ModuleGrid
          tenant={cms.tenant}
          modules={cms.modules}
          userId={user?.id ?? null}
        />
      </PublicTenantShell>
    );
  }

  // Fallback: legacy default homepage (used until tenant configures modules).
  // Sprint 78b — herzien naar mockup-grid (Welkom-CTA's + Nieuws-lijst +
  // Uitgelichte foto's). Bestaande hero blijft als banner.
  const data = await getPublicTenantHomeData(slug);
  if (!data) notFound();
  const { tenant, latestNews } = data;

  const photos = await getMediaWallItems(tenant.id, 12);

  return (
    <PublicTenantShell
      tenant={tenant}
      pageTitle={`Welkom bij ${tenant.name}`}
      active="home"
    >
      {/* Hero met accent-balk links (mockup-stijl) */}
      <div className="relative overflow-hidden rounded-[var(--radius-nxt-lg)]">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 z-10 w-1"
          style={{ backgroundColor: "var(--tenant-accent)" }}
        />
        <div className="h-[240px] sm:h-[280px]">
          <PublicHeroSlider tenantName={tenant.name} />
        </div>
      </div>

      {user && (
        <TodayBlock
          tenantId={tenant.id}
          tenantSlug={tenant.slug}
          userId={user.id}
        />
      )}

      {/* Module-grid: 3-koloms op desktop, met spans op grotere tegels.
          Welkom-CTA's links, Nieuws-lijst midden, Uitgelichte foto's rechts. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <CtaCard
          icon={CalendarPlus}
          title="Schrijf je in voor een proefles"
          body="Probeer een training mee en ontdek de academie."
          ctaLabel="Proefles aanvragen"
          href={`/t/${tenant.slug}/proefles`}
        />
        <CtaCard
          icon={ClipboardList}
          title="Direct inschrijven"
          body="Word aspirant-lid en start je inschrijving meteen."
          ctaLabel="Inschrijven"
          href={`/t/${tenant.slug}/inschrijven`}
        />
        <NewsListCard tenantSlug={tenant.slug} posts={latestNews} limit={4} />
        {photos.length > 0 && (
          <div className="sm:col-span-2 lg:col-span-1">
            <FeaturedPhotosCard
              photos={photos.map((p) => ({
                id: p.id,
                media_url: p.media_url,
                title: p.title,
              }))}
            />
          </div>
        )}
      </div>
    </PublicTenantShell>
  );
}

function CtaCard({
  icon: Icon,
  title,
  body,
  ctaLabel,
  href,
}: {
  icon: typeof CalendarPlus;
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
}) {
  return (
    <PublicCard className="flex h-full flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--tenant-accent) 22%, transparent)",
            color: "var(--text-primary)",
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h3>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {body}
          </p>
        </div>
      </div>
      <div className="mt-auto pt-2">
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: "var(--tenant-accent)",
            color: "var(--text-primary)",
          }}
        >
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </PublicCard>
  );
}
