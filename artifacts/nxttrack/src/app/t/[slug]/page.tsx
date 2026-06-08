import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Award, CalendarDays, CalendarPlus, CheckCircle2, ClipboardList, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getPublicTenantHomeData } from "@/lib/db/public-tenant";
import {
  getPublicHomepageData,
  getMediaWallItems,
  getRandomPublicTrainers,
} from "@/lib/db/homepage";
import {
  getFeaturedTenantEvent,
  listPublicUpcomingSessions,
} from "@/lib/db/tenant-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { UpcomingSessionsCard } from "@/components/public/upcoming-sessions-card";
import { FeaturedEventCard } from "@/components/public/featured-event-card";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import { PublicCard } from "@/components/public/public-card";
import { PublicHeroSlider } from "@/components/public/public-hero-slider";
import { TodayBlock } from "@/components/public/today-block";
import { ModuleGrid } from "@/components/homepage/module-grid";
import { NewsListCard } from "@/components/public/news-list-card";
import { FeaturedPhotosCard } from "@/components/public/featured-photos-card";
import { WelcomeCard } from "@/components/public/welcome-card";
import { LocationCard } from "@/components/public/location-card";
import { TrainersCard } from "@/components/public/trainers-card";
import { getUser } from "@/lib/auth/get-user";
import { UserHomeDashboard } from "@/components/public/user-home-dashboard";

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
        {user && (
          <UserHomeDashboard
            tenant={cms.tenant}
            userId={user.id}
          />
        )}
        {!user && <MarketingHero tenant={cms.tenant} />}
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

  // Sprint 79 — lees `public_show_upcoming_sessions`-toggle + featured event +
  // (optioneel) eerstvolgende sessies parallel met de bestaande fetches.
  const admin = createAdminClient();
  const tenantSettingsPromise = admin
    .from("tenants")
    .select("settings_json")
    .eq("id", tenant.id)
    .maybeSingle()
    .then((r) => (r.data?.settings_json ?? {}) as Record<string, unknown>);

  const [photos, randomTrainers, settings, featuredEvent] = await Promise.all([
    getMediaWallItems(tenant.id, 12),
    getRandomPublicTrainers(tenant.id, 3),
    tenantSettingsPromise,
    getFeaturedTenantEvent(tenant.id),
  ]);
  const showUpcomingSessions = settings.public_show_upcoming_sessions === true;
  const upcomingSessions = showUpcomingSessions
    ? await listPublicUpcomingSessions(tenant.id, 5)
    : [];

  return (
    <PublicTenantShell
      tenant={tenant}
      pageTitle={`Welkom bij ${tenant.name}`}
      active="home"
    >
      {user && (
        <UserHomeDashboard
          tenant={tenant}
          userId={user.id}
        />
      )}
      {!user && <MarketingHero tenant={tenant} />}
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

      {/* Module-grid: 3-koloms op desktop. Sprint 78b voegt Welkom, Locatie
          en Trainers toe naast de bestaande CTA's, Nieuws en Foto's. Lege
          modules (zonder data) renderen `null` en houden de grid schoon. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:auto-rows-[280px] lg:grid-cols-3">
        <WelcomeCard tenant={tenant} />
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
        {featuredEvent && <FeaturedEventCard event={featuredEvent} />}
        {showUpcomingSessions && (
          <UpcomingSessionsCard sessions={upcomingSessions} />
        )}
        <TrainersCard trainers={randomTrainers} tenantSlug={tenant.slug} />
        <LocationCard tenant={tenant} />
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

function MarketingHero({
  tenant,
}: {
  tenant: {
    name: string;
    slug: string;
    logo_url: string | null;
    welcome_text?: string | null;
  };
}) {
  return (
    <section className="nxt-shell-surface relative overflow-hidden rounded-[24px] p-5 sm:p-7 lg:p-8">
      <div
        aria-hidden
        className="absolute -right-20 -top-20 h-72 w-72 rounded-full blur-3xl"
        style={{ backgroundColor: "color-mix(in srgb, var(--tenant-accent) 34%, transparent)" }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 right-8 hidden h-40 w-72 rounded-t-full lg:block"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--shell-info) 18%, transparent), transparent)",
        }}
      />
      <div className="relative grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)", color: "var(--text-primary)" }}>
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--shell-info)" }} />
            Zwemschool platform
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: "var(--text-primary)" }}>
            Welkom bij {tenant.name}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7" style={{ color: "var(--text-secondary)" }}>
            {tenant.welcome_text?.trim() ||
              "Slim inschrijven, duidelijk plannen en stap voor stap groeien naar badges en diploma's."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/t/${tenant.slug}/inschrijven`} className="nxt-focus-ring nxt-shell-primary-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">
              Inschrijven
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={`/t/${tenant.slug}/proefles`} className="nxt-focus-ring nxt-shell-soft-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">
              Proefles plannen
              <CalendarPlus className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Slimme intake", icon: ClipboardList },
              { label: "Mooie voortgang", icon: Award },
              { label: "Veilig portaal", icon: ShieldCheck },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border px-3 py-3 text-sm font-semibold" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)", color: "var(--text-primary)" }}>
                  <Icon className="mb-2 h-4 w-4" style={{ color: "var(--shell-info)" }} />
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative">
          <div className="nxt-shell-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-strong)" }}>
                  {tenant.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tenant.logo_url} alt={tenant.name} className="h-full w-full object-contain" />
                  ) : (
                    <Award className="h-7 w-7" style={{ color: "var(--shell-info)" }} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Zwemreis preview</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Van intake naar diploma</p>
                </div>
              </div>
              <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: "color-mix(in srgb, var(--shell-success) 12%, var(--shell-panel-strong))", color: "var(--shell-success)" }}>
                Live
              </span>
            </div>
            <div className="mt-5 rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #062b66, #0b63ff)", color: "#ffffff" }}>
              <p className="text-sm font-semibold opacity-85">Bijna klaar voor</p>
              <p className="mt-1 text-2xl font-bold">Diploma A</p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/25">
                <span className="block h-full w-[78%] rounded-full bg-[#78c90f]" />
              </div>
              <p className="mt-2 text-xs opacity-85">Nog 2 onderdelen te gaan</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: "Volgende les", value: "Wo 16:30", icon: CalendarDays },
                { label: "Plaatsing", value: "Bevestigd", icon: CheckCircle2 },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border p-3" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)" }}>
                    <Icon className="h-4 w-4" style={{ color: "var(--shell-info)" }} />
                    <p className="mt-2 text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaCard({
  icon: Icon,
  title,
  body,
  ctaLabel,
  href,
}: {
  icon: LucideIcon;
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
