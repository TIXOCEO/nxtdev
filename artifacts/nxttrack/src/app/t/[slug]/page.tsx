import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Home,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
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
  const trustItems = [
    { label: "Slimme intake", icon: ClipboardList },
    { label: "Voortgang per kind", icon: Trophy },
    { label: "Diploma downloads", icon: GraduationCap },
  ];
  const journey = [
    { label: "Water", complete: true },
    { label: "Drijven", complete: true },
    { label: "Diploma A", complete: true, active: true },
    { label: "Diploma B", complete: false },
    { label: "Diploma C", complete: false },
  ];
  const quickActions = [
    { label: "Lessen", icon: BookOpen },
    { label: "Voortgang", icon: Trophy },
    { label: "Berichten", icon: MessageCircle },
  ];

  return (
    <section className="nxt-marketing-hero nxt-shell-surface relative overflow-hidden rounded-[28px] p-0">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-32"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in srgb, var(--tenant-accent) 16%, transparent), color-mix(in srgb, var(--shell-info) 12%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="absolute -right-24 top-16 hidden h-96 w-96 rounded-full blur-3xl lg:block"
        style={{
          background: "color-mix(in srgb, var(--tenant-accent) 28%, transparent)",
        }}
      />
      <div className="nxt-marketing-hero-grid relative grid min-h-[560px] gap-8 p-5 sm:p-7 lg:grid-cols-[0.88fr_1.12fr] lg:items-stretch lg:p-8">
        <div className="flex flex-col justify-between gap-8 py-1">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)", color: "var(--text-primary)" }}>
              <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--shell-info)" }} />
              Zwemschool platform
            </div>
            <h1 className="mt-5 max-w-[12ch] text-4xl font-black tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[0.96]" style={{ color: "var(--text-primary)" }}>
              Welkom bij {tenant.name}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 sm:text-lg" style={{ color: "var(--text-secondary)" }}>
              {tenant.welcome_text?.trim() ||
                "Een moderne zwemschoolervaring voor ouders, leerlingen en trainers: van proefles en intake tot badges, voortgang en diploma's."}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={`/t/${tenant.slug}/inschrijven`} className="nxt-focus-ring nxt-shell-primary-button inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold">
                Start inschrijving
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={`/t/${tenant.slug}/proefles`} className="nxt-focus-ring nxt-shell-soft-button inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold">
                Plan proefles
                <CalendarPlus className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="nxt-marketing-trust-grid grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="nxt-shell-card flex min-h-20 items-center gap-3 px-3 py-3 text-sm font-bold">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: "color-mix(in srgb, var(--tenant-accent) 16%, var(--shell-panel-muted))", color: "var(--shell-info)" }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="nxt-marketing-preview relative grid min-h-[500px] items-end lg:grid-cols-[minmax(0,1fr)_245px] lg:gap-5">
          <div className="nxt-shell-card relative overflow-hidden p-4 sm:p-5 lg:mb-8">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-28"
              style={{
                background:
                  "linear-gradient(120deg, color-mix(in srgb, var(--shell-info) 14%, transparent), color-mix(in srgb, var(--tenant-accent) 16%, transparent), transparent)",
              }}
            />
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
                  <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Familie Jansen</p>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Bad 2 - Lisa</p>
                </div>
              </div>
              <Bell className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </div>

            <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Huidig niveau", value: "Diploma A", icon: Award },
                { label: "Volgende les", value: "Wo 16:30", icon: CalendarDays },
                { label: "Plaatsing", value: "Bevestigd", icon: CheckCircle2 },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border p-3" style={{ borderColor: "var(--shell-border)", backgroundColor: "color-mix(in srgb, var(--shell-panel-strong) 78%, transparent)" }}>
                    <Icon className="h-4 w-4" style={{ color: item.icon === CheckCircle2 ? "var(--shell-success)" : "var(--shell-info)" }} />
                    <p className="mt-3 text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
                    <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{item.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(190px,0.9fr)]">
              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)" }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Sem's zwemreis</h2>
                  <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>78%</span>
                </div>
                <div className="mt-5 grid grid-cols-5 gap-2">
                  {journey.map((step) => (
                    <div key={step.label} className="min-w-0 text-center">
                      <div
                        className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-xs font-black"
                        style={{
                          borderColor: step.active ? "var(--shell-info)" : step.complete ? "var(--shell-success)" : "var(--shell-border)",
                          backgroundColor: step.active
                            ? "var(--shell-info)"
                            : step.complete
                              ? "var(--shell-success)"
                              : "var(--shell-panel-strong)",
                          color: step.complete || step.active ? "#ffffff" : "var(--text-secondary)",
                        }}
                      >
                        {step.complete ? <CheckCircle2 className="h-4 w-4" /> : step.label.charAt(0)}
                      </div>
                      <p className="mt-2 truncate text-[10px] font-bold" style={{ color: step.active ? "var(--shell-info)" : "var(--text-secondary)" }}>
                        {step.label}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="nxt-shell-progress mt-5 h-2">
                  <span className="w-[78%]" />
                </div>
                <p className="mt-3 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>6 van 8 onderdelen behaald</p>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)" }}>
                <h2 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Badge wall</h2>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[ShieldCheck, Trophy, Award, Home, BookOpen, GraduationCap].map((Icon, index) => (
                    <span
                      key={index}
                      className="flex aspect-square items-center justify-center rounded-2xl border"
                      style={{
                        borderColor: "var(--shell-border)",
                        backgroundColor: index % 2 === 0 ? "#082c6f" : "var(--shell-info)",
                        color: index === 1 ? "var(--tenant-accent)" : "#ffffff",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  ))}
                </div>
                <Link href={`/t/${tenant.slug}/login`} className="mt-4 inline-flex items-center gap-1 text-xs font-black" style={{ color: "var(--shell-info)" }}>
                  Bekijk badges
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-0 right-3 hidden h-[500px] w-[236px] rounded-[34px] border-[8px] border-slate-950 bg-white shadow-2xl lg:block">
            <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-slate-950" />
            <div className="h-full overflow-hidden rounded-[25px] p-4 pt-9" style={{ backgroundColor: "var(--shell-page-bg)" }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>Hoi Sem</p>
                  <p className="text-base font-black" style={{ color: "var(--text-primary)" }}>Vandaag</p>
                </div>
                <Bell className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
              </div>
              <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-strong)" }}>
                <p className="text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>Volgende les</p>
                <p className="mt-1 text-sm font-black" style={{ color: "var(--text-primary)" }}>Wo 22 mei - 16:30</p>
                <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Bad 2 - Lisa</p>
              </div>
              <div className="mt-3 rounded-2xl p-3" style={{ background: "linear-gradient(135deg, #062b66, #0b63ff)", color: "#ffffff" }}>
                <p className="text-[10px] font-bold opacity-80">Bijna klaar voor</p>
                <p className="text-lg font-black">Diploma A</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/25">
                  <span className="block h-full w-[78%] rounded-full bg-[#78c90f]" />
                </div>
                <p className="mt-2 text-[10px] opacity-85">Nog 2 onderdelen</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {quickActions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-xl border py-2 text-center" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-strong)" }}>
                      <Icon className="mx-auto h-4 w-4" style={{ color: "var(--shell-info)" }} />
                      <p className="mt-1 text-[9px] font-bold" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
                    </div>
                  );
                })}
              </div>
              <div className="absolute inset-x-4 bottom-4 grid grid-cols-4 gap-2 rounded-2xl border p-2" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-strong)" }}>
                {[Home, BookOpen, Trophy, MessageCircle].map((Icon, index) => (
                  <span key={index} className="flex h-8 items-center justify-center rounded-xl" style={{ color: index === 0 ? "var(--shell-info)" : "var(--text-secondary)" }}>
                    <Icon className="h-4 w-4" />
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:hidden">
            <div className="nxt-shell-card mx-auto mt-1 max-w-[360px] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>Mobiele app-preview</p>
                <span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ backgroundColor: "color-mix(in srgb, var(--tenant-accent) 18%, var(--shell-panel-muted))", color: "var(--text-primary)" }}>78%</span>
              </div>
              <div className="mt-4 rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #062b66, #0b63ff)", color: "#ffffff" }}>
                <p className="text-xs font-bold opacity-80">Bijna klaar voor</p>
                <p className="text-2xl font-black">Diploma A</p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/25">
                  <span className="block h-full w-[78%] rounded-full bg-[#78c90f]" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {quickActions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl border p-3 text-center" style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--shell-panel-muted)" }}>
                      <Icon className="mx-auto h-4 w-4" style={{ color: "var(--shell-info)" }} />
                      <p className="mt-2 text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="nxt-marketing-proof-strip relative grid gap-3 border-t px-5 py-4 sm:grid-cols-3 sm:px-7 lg:px-8" style={{ borderColor: "var(--shell-border)", backgroundColor: "color-mix(in srgb, #062b66 92%, var(--shell-panel-strong))", color: "#ffffff" }}>
        {[
          { title: "Veilig", body: "Persoonlijk portaal voor ieder gezin." },
          { title: "Duidelijk", body: "Lessen, badges en voortgang op een plek." },
          { title: "Tenant-proof", body: "Kleuren en branding per zwemschool." },
        ].map((item) => (
          <div key={item.title} className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0" style={{ color: "var(--tenant-accent)" }} />
            <div>
              <p className="text-xs font-black">{item.title}</p>
              <p className="text-[11px] opacity-75">{item.body}</p>
            </div>
          </div>
        ))}
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
    <PublicCard className="nxt-shell-hover flex h-full flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--tenant-accent) 18%, var(--shell-panel-muted))",
            color: "var(--shell-info)",
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
          className="nxt-focus-ring nxt-shell-primary-button inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-bold transition-transform hover:-translate-y-0.5"
        >
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </PublicCard>
  );
}
