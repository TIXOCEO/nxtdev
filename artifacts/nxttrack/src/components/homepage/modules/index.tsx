import Link from "next/link";
import {
  Calendar,
  Megaphone,
  AlertTriangle,
  PlayCircle,
  ExternalLink,
  UserRound,
  Bell,
  CalendarPlus,
  MessageCircle,
  Heart,
} from "lucide-react";
import { ModuleContainer } from "../module-container";
import { PublicHeroSlider, type HeroSlide } from "@/components/public/public-hero-slider";
import { ImageSliderClient, type ImageSliderImage } from "./image-slider-client";
import {
  getActiveAlerts,
  getMediaWallItems,
  getSponsors,
  getPublicTrainers,
} from "@/lib/db/homepage";
import { getPublicNewsPosts } from "@/lib/db/public-tenant";
import { getSessionsForUser } from "@/lib/db/trainings";
import { getMyNotifications } from "@/lib/db/notifications";
import type { Tenant, TenantModule } from "@/types/database";

interface BaseProps {
  tenant: Tenant;
  module: TenantModule;
}
interface AuthedProps extends BaseProps {
  userId?: string | null;
}

function tag<T = unknown>(cfg: Record<string, unknown>, key: string, fb: T): T {
  const v = cfg[key];
  return (v === undefined || v === null ? fb : v) as T;
}

// ──────────────── Hero Slider ────────────────
// Render direct PublicHeroSlider zonder ModuleContainer-wrapper:
// de slider heeft zijn eigen border + radius en moet niet dubbel geframed worden.
export function HeroSliderModule({ tenant, module }: BaseProps) {
  const slidesCfg = tag<
    Array<
      Partial<
        HeroSlide & {
          media_url?: string;
          media_type?: string;
          cta_label?: string;
          cta_url?: string;
          subtitle?: string;
          background_image_url?: string;
        }
      >
    >
  >(module.config, "slides", []);
  const slides: HeroSlide[] = slidesCfg.map((s) => ({
    eyebrow: s.subtitle ?? s.eyebrow ?? "",
    title: s.title ?? "",
    body: s.body ?? "",
    ctaLabel: s.cta_label ?? s.ctaLabel,
    ctaHref: s.cta_url ?? s.ctaHref,
    backgroundImageUrl: s.background_image_url,
  }));
  return (
    <PublicHeroSlider tenantName={tenant.name} slides={slides.length ? slides : undefined} />
  );
}

// ──────────────── News Hero Slider ────────────────
// Toont de laatste nieuwsberichten als slides; cover_image_url wordt
// als achtergrondfoto gebruikt zodat het er full-bleed editorial uit ziet.
export async function NewsHeroSliderModule({ tenant, module }: BaseProps) {
  const limit = tag<number>(module.config, "limit", 5);
  const categoryRaw = tag<string>(module.config, "category_id", "");
  const categoryId = categoryRaw && categoryRaw.length > 0 ? categoryRaw : null;
  const posts = await getPublicNewsPosts(tenant.id, { limit, categoryId });
  const slides: HeroSlide[] = posts.map((p) => ({
    eyebrow: "Nieuws",
    title: p.title,
    body: p.excerpt ?? "",
    ctaLabel: "Lees meer",
    ctaHref: `/t/${tenant.slug}/nieuws/${p.slug}`,
    backgroundImageUrl: p.cover_image_url ?? undefined,
  }));
  if (slides.length === 0) return null;
  return <PublicHeroSlider tenantName={tenant.name} slides={slides} />;
}

// ──────────────── News ────────────────
export async function NewsModule({ tenant, module }: BaseProps) {
  const limit = tag<number>(module.config, "limit", 3);
  const posts = await getPublicNewsPosts(tenant.id, { limit });
  return (
    <ModuleContainer
      title={module.title || "Laatste nieuws"}
      action={{ label: "Bekijk alles", href: `/t/${tenant.slug}/nieuws` }}
    >
      {posts.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen nieuwsberichten.
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/t/${tenant.slug}/nieuws/${p.slug}`}
                className="group flex items-start gap-3"
              >
                {p.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.cover_image_url}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="h-12 w-12 shrink-0 rounded-lg"
                    style={{ backgroundColor: "var(--surface-soft)" }}
                  />
                )}
                <div className="min-w-0">
                  <p
                    className="truncate text-xs font-semibold group-hover:underline"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.title}
                  </p>
                  {p.excerpt && (
                    <p
                      className="line-clamp-2 text-[11px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {p.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ModuleContainer>
  );
}

// ──────────────── Custom Content ────────────────
export function CustomContentModule({ module }: BaseProps) {
  const html = tag<string>(module.config, "content_html", "");
  return (
    <ModuleContainer title={module.title || null}>
      {html ? (
        <div
          className="tiptap-html prose prose-sm max-w-none"
          style={{ color: "var(--text-primary)" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen inhoud toegevoegd.
        </p>
      )}
    </ModuleContainer>
  );
}

// ──────────────── Video ────────────────
export function VideoModule({ module }: BaseProps) {
  const url = tag<string>(module.config, "video_url", "");
  const provider = tag<string>(module.config, "provider", "youtube");
  let embed = "";
  if (url) {
    if (provider === "youtube") {
      const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
      if (m) embed = `https://www.youtube.com/embed/${m[1]}`;
    } else if (provider === "vimeo") {
      const m = url.match(/vimeo\.com\/(\d+)/);
      if (m) embed = `https://player.vimeo.com/video/${m[1]}`;
    }
  }
  return (
    <ModuleContainer title={module.title || "Video"}>
      {embed ? (
        <div className="aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={embed}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      ) : (
        <div
          className="flex aspect-video items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--surface-soft)", color: "var(--text-secondary)" }}
        >
          <PlayCircle className="h-8 w-8" />
        </div>
      )}
    </ModuleContainer>
  );
}

// ──────────────── CTA ────────────────
export function CtaModule({ module }: BaseProps) {
  const text = tag<string>(module.config, "text", "");
  const label = tag<string>(module.config, "button_label", "");
  const url = tag<string>(module.config, "button_url", "");
  return (
    <ModuleContainer title={module.title || null}>
      <div className="flex flex-col items-start gap-3">
        {text && (
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            {text}
          </p>
        )}
        {url && label && (
          <Link
            href={url}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            {label} <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </ModuleContainer>
  );
}

// ──────────────── Sponsors ────────────────
export async function SponsorsModule({ tenant, module }: BaseProps) {
  const limit = tag<number>(module.config, "limit", 12);
  const sponsors = await getSponsors(tenant.id, limit);
  return (
    <ModuleContainer title={module.title || "Sponsoren"}>
      {sponsors.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen sponsoren.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sponsors.map((s) => {
            const inner = (
              <div
                className="flex h-16 items-center justify-center rounded-lg border p-2"
                style={{
                  backgroundColor: "var(--surface-soft)",
                  borderColor: "var(--surface-border)",
                }}
              >
                {s.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo_url} alt={s.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {s.name}
                  </span>
                )}
              </div>
            );
            return s.website_url ? (
              <a key={s.id} href={s.website_url} target="_blank" rel="noopener noreferrer">
                {inner}
              </a>
            ) : (
              <div key={s.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </ModuleContainer>
  );
}

// ──────────────── Events / Trainings ────────────────
export async function EventsTrainingsModule({ tenant, module, userId }: AuthedProps) {
  const limit = tag<number>(module.config, "limit", 5);
  const all = userId
    ? await getSessionsForUser(tenant.id, userId, {
        fromIso: new Date().toISOString(),
      })
    : [];
  const sessions = all.slice(0, limit);
  return (
    <ModuleContainer
      title={module.title || "Aankomende trainingen"}
      action={{ label: "Volledige agenda", href: `/t/${tenant.slug}/schedule` }}
    >
      {!userId ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Log in om je persoonlijke agenda te zien.
        </p>
      ) : sessions.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Geen trainingen gepland.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.slice(0, limit).map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2"
              style={{
                backgroundColor: "var(--surface-soft)",
                borderColor: "var(--surface-border)",
              }}
            >
              <Calendar
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--accent)" }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-xs font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {s.title}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  {new Date(s.starts_at).toLocaleString("nl-NL", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ModuleContainer>
  );
}

// ──────────────── Media Wall ────────────────
export async function MediaWallModule({ tenant, module }: BaseProps) {
  const limit = tag<number>(module.config, "limit", 9);
  const items = await getMediaWallItems(tenant.id, limit);
  return (
    <ModuleContainer title={module.title || "Media Wall"}>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen media toegevoegd.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.id}
              className="aspect-square overflow-hidden rounded-lg border"
              style={{ borderColor: "var(--surface-border)" }}
            >
              {it.media_type === "video" ? (
                <video src={it.media_url} className="h-full w-full object-cover" muted playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.media_url} alt={it.title ?? ""} className="h-full w-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}
    </ModuleContainer>
  );
}

// ──────────────── Personal Dashboard ────────────────
export async function PersonalDashboardModule({ tenant, module, userId }: AuthedProps) {
  if (!userId) return null;
  const showNext = tag<boolean>(module.config, "show_next_training", true);
  const showNotif = tag<boolean>(module.config, "show_latest_notifications", true);
  const showQuick = tag<boolean>(module.config, "show_quick_actions", true);

  const [sessions, notifs] = await Promise.all([
    showNext
      ? getSessionsForUser(tenant.id, userId, { fromIso: new Date().toISOString() })
      : Promise.resolve([]),
    showNotif ? getMyNotifications(3) : Promise.resolve([]),
  ]);
  const tenantNotifs = notifs.filter((n) => n.notification.tenant_id === tenant.id);
  const next = sessions[0];

  return (
    <ModuleContainer title={module.title || "Mijn dashboard"}>
      <div className="space-y-3">
        {showNext && (
          <div
            className="rounded-lg border px-3 py-2"
            style={{
              backgroundColor: "var(--surface-soft)",
              borderColor: "var(--surface-border)",
            }}
          >
            <p
              className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              <Calendar className="h-3 w-3" /> Volgende training
            </p>
            {next ? (
              <p className="mt-1 text-xs" style={{ color: "var(--text-primary)" }}>
                {next.title} —{" "}
                {new Date(next.starts_at).toLocaleString("nl-NL", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            ) : (
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Geen geplande trainingen.
              </p>
            )}
          </div>
        )}

        {showNotif && tenantNotifs.length > 0 && (
          <div>
            <p
              className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              <Bell className="h-3 w-3" /> Recente meldingen
            </p>
            <ul className="mt-1 space-y-1">
              {tenantNotifs.slice(0, 3).map((n) => (
                <li
                  key={n.recipient_id}
                  className="text-xs"
                  style={{ color: "var(--text-primary)" }}
                >
                  • {n.notification.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showQuick && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/t/${tenant.slug}/schedule`}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              <CalendarPlus className="h-3 w-3" /> Agenda
            </Link>
            <Link
              href={`/t/${tenant.slug}/notifications`}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              <Bell className="h-3 w-3" /> Meldingen
            </Link>
            <Link
              href={`/t/${tenant.slug}/profile`}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              <UserRound className="h-3 w-3" /> Profiel
            </Link>
          </div>
        )}
      </div>
    </ModuleContainer>
  );
}

// ──────────────── Alerts / Announcements ────────────────
export async function AlertsAnnouncementsModule({ tenant, module }: BaseProps) {
  const showAlerts = tag<boolean>(module.config, "show_alerts", true);
  const showAnn = tag<boolean>(module.config, "show_announcements", true);
  const all = await getActiveAlerts(tenant.id);
  const filtered = all.filter(
    (a) => (a.type === "alert" && showAlerts) || (a.type === "announcement" && showAnn),
  );
  if (filtered.length === 0) return null;
  return (
    <ModuleContainer title={module.title || "Aankondigingen"}>
      <ul className="space-y-2">
        {filtered.map((a) => {
          const isAlert = a.type === "alert";
          const Icon = isAlert ? AlertTriangle : Megaphone;
          return (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-lg border px-3 py-2"
              style={{
                backgroundColor: isAlert ? "rgba(220,38,38,0.06)" : "var(--surface-soft)",
                borderColor: isAlert ? "rgba(220,38,38,0.3)" : "var(--surface-border)",
              }}
            >
              <Icon
                className="h-4 w-4 shrink-0"
                style={{ color: isAlert ? "#dc2626" : "var(--accent)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  {a.title}
                </p>
                {a.content && (
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {a.content}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </ModuleContainer>
  );
}

// ──────────────── Trainers ────────────────
export async function TrainersModule({ tenant, module }: BaseProps) {
  const limit = tag<number>(module.config, "limit", 8);
  const showBio = tag<boolean>(module.config, "show_bio", true);
  const trainers = await getPublicTrainers(tenant.id, limit);
  return (
    <ModuleContainer title={module.title || "Onze trainers"}>
      {trainers.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen trainers gemarkeerd als publiek zichtbaar.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {trainers.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-3 rounded-lg border px-3 py-2"
              style={{
                backgroundColor: "var(--surface-soft)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
              >
                <UserRound className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p
                  className="truncate text-xs font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t.full_name}
                </p>
                {showBio && t.public_bio && (
                  <p className="line-clamp-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {t.public_bio}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ModuleContainer>
  );
}

// ──────────────── Social Feed ────────────────
import { getFeedPosts } from "@/lib/db/social";

async function SocialFeedModule({ tenant, module, userId }: AuthedProps) {
  const limit = tag<number>(module.config, "limit", 5);
  const filter = tag<"all" | "team" | "coach" | "achievements">(
    module.config,
    "filter",
    "all",
  );
  const { items } = await getFeedPosts({
    tenantId: tenant.id,
    userId: userId ?? null,
    limit,
    filter,
  });
  return (
    <ModuleContainer title={module.title || "Social feed"}>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen berichten in de feed.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.post.id}
              className="rounded-lg border px-3 py-2"
              style={{
                backgroundColor: "var(--surface-soft)",
                borderColor: "var(--surface-border)",
              }}
            >
              <Link
                href={`/t/${tenant.slug}/feed/${it.post.id}`}
                className="block"
              >
                <p
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {it.author?.full_name ?? "Onbekend"}
                </p>
                {it.post.content && (
                  <p
                    className="mt-0.5 line-clamp-2 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {it.post.content}
                  </p>
                )}
                <div
                  className="mt-1 flex items-center gap-3 text-[11px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {it.likes_count}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {it.comments_count}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Link
          href={`/t/${tenant.slug}/feed`}
          className="text-xs font-semibold"
          style={{ color: "var(--accent)" }}
        >
          Bekijk alle berichten →
        </Link>
      </div>
    </ModuleContainer>
  );
}

// ──────────────── Image Slider ────────────────
// Sprint 29 — Eén afbeelding = stilstaand beeld; meerdere = autoplay slider.
// Vult altijd de containerhoogte (h-full); valt terug op een placeholder als
// er nog geen afbeeldingen zijn ingesteld.
export function ImageSliderModule({ module }: BaseProps) {
  const rawImages = tag<unknown>(module.config, "images", []);
  const images: ImageSliderImage[] = Array.isArray(rawImages)
    ? rawImages.flatMap((it): ImageSliderImage[] => {
        if (!it || typeof it !== "object") return [];
        const obj = it as Record<string, unknown>;
        const url = typeof obj.url === "string" ? obj.url.trim() : "";
        if (!url) return [];
        return [
          {
            url,
            alt: typeof obj.alt === "string" ? obj.alt : undefined,
            link: typeof obj.link === "string" && obj.link ? obj.link : undefined,
          },
        ];
      })
    : [];
  const autoplay = tag<boolean>(module.config, "autoplay", true);
  const interval = tag<number>(module.config, "interval", 5000);

  if (images.length === 0) {
    return (
      <ModuleContainer title={module.title || "Beeld slider"}>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen afbeeldingen toegevoegd.
        </p>
      </ModuleContainer>
    );
  }

  return (
    <ImageSliderClient
      images={images}
      autoplay={autoplay}
      intervalMs={interval}
    />
  );
}

// ──────────────── Google Maps ────────────────
// Sprint 29 — Gratis Maps embed (geen API-key vereist) op basis van adres.
// Iframe vult de volledige containerhoogte.
export function GoogleMapsModule({ module }: BaseProps) {
  const address = tag<string>(module.config, "address", "").trim();
  const zoomRaw = tag<number>(module.config, "zoom", 14);
  const zoom = Math.max(1, Math.min(20, Number.isFinite(zoomRaw) ? zoomRaw : 14));
  if (!address) {
    return (
      <ModuleContainer title={module.title || "Google Maps"}>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Voer een adres in om de kaart te tonen.
        </p>
      </ModuleContainer>
    );
  }
  const src = `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=${zoom}&output=embed`;
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[var(--radius-nxt-lg)] border"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-soft)",
      }}
    >
      <iframe
        title={module.title || `Kaart van ${address}`}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="absolute inset-0 h-full w-full border-0"
        allowFullScreen
      />
    </div>
  );
}

// ──────────────── Renderer dispatcher ────────────────
export async function renderModule(
  tenant: Tenant,
  module: TenantModule,
  userId: string | null,
) {
  switch (module.module_key) {
    case "hero_slider":
      return <HeroSliderModule tenant={tenant} module={module} />;
    case "news_hero_slider":
      return <NewsHeroSliderModule tenant={tenant} module={module} />;
    case "news":
      return <NewsModule tenant={tenant} module={module} />;
    case "custom_content":
      return <CustomContentModule tenant={tenant} module={module} />;
    case "video":
      return <VideoModule tenant={tenant} module={module} />;
    case "cta":
      return <CtaModule tenant={tenant} module={module} />;
    case "sponsors":
      return <SponsorsModule tenant={tenant} module={module} />;
    case "events_trainings":
      return <EventsTrainingsModule tenant={tenant} module={module} userId={userId} />;
    case "media_wall":
      return <MediaWallModule tenant={tenant} module={module} />;
    case "personal_dashboard":
      return <PersonalDashboardModule tenant={tenant} module={module} userId={userId} />;
    case "alerts_announcements":
      return <AlertsAnnouncementsModule tenant={tenant} module={module} />;
    case "trainers":
      return <TrainersModule tenant={tenant} module={module} />;
    case "social_feed":
      return <SocialFeedModule tenant={tenant} module={module} userId={userId} />;
    case "image_slider":
      return <ImageSliderModule tenant={tenant} module={module} />;
    case "google_maps":
      return <GoogleMapsModule tenant={tenant} module={module} />;
    default:
      return (
        <ModuleContainer title={module.title || "Onbekende module"}>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Module type "{module.module_key}" wordt niet ondersteund.
          </p>
        </ModuleContainer>
      );
  }
}
