import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarPlus, ClipboardList, Newspaper } from "lucide-react";
import { getPublicTenantHomeData } from "@/lib/db/public-tenant";
import { getPublicHomepageData } from "@/lib/db/homepage";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import { PublicHeroSlider } from "@/components/public/public-hero-slider";
import { TodayBlock } from "@/components/public/today-block";
import { ModuleGrid } from "@/components/homepage/module-grid";
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
      <PublicTenantShell tenant={cms.tenant} pageTitle="Home" active="home">
        <ModuleGrid tenant={cms.tenant} modules={cms.modules} userId={user?.id ?? null} />
      </PublicTenantShell>
    );
  }

  // Fallback: legacy default homepage (used until tenant configures modules).
  const data = await getPublicTenantHomeData(slug);
  if (!data) notFound();
  const { tenant, latestNews } = data;

  return (
    <PublicTenantShell tenant={tenant} pageTitle="Home" active="home">
      <PublicHeroSlider tenantName={tenant.name} />

      {user && (
        <TodayBlock tenantId={tenant.id} tenantSlug={tenant.slug} userId={user.id} />
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Laatste nieuws
            </h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              De meest recente aankondigingen en verhalen.
            </p>
          </div>
          <Link
            href={`/t/${tenant.slug}/nieuws`}
            className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
            style={{ color: "var(--text-primary)" }}
          >
            Bekijk alles <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {latestNews.length === 0 ? (
          <PublicCard className="flex flex-col items-center gap-2 p-8 text-center">
            <Newspaper className="h-8 w-8" style={{ color: "var(--text-secondary)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Nog geen nieuws geplaatst
            </p>
          </PublicCard>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latestNews.map((post) => (
              <NewsTile key={post.id} tenantSlug={tenant.slug} post={post} />
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </section>
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
            backgroundColor: "color-mix(in srgb, var(--tenant-accent) 22%, transparent)",
            color: "var(--text-primary)",
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
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
          style={{ backgroundColor: "var(--tenant-accent)", color: "var(--text-primary)" }}
        >
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </PublicCard>
  );
}

function NewsTile({
  tenantSlug,
  post,
}: {
  tenantSlug: string;
  post: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    cover_image_url: string | null;
    published_at: string | null;
    created_at: string;
  };
}) {
  const date = post.published_at ?? post.created_at;
  return (
    <Link
      href={`/t/${tenantSlug}/nieuws/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-nxt-lg)] border transition-shadow hover:shadow-md"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
        boxShadow: "var(--shadow-app)",
      }}
    >
      <div
        className="aspect-[16/9] w-full overflow-hidden"
        style={{ backgroundColor: "var(--surface-soft)" }}
      >
        {post.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          {new Date(date).toLocaleDateString("nl-NL")}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="line-clamp-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            {post.excerpt}
          </p>
        )}
      </div>
    </Link>
  );
}
