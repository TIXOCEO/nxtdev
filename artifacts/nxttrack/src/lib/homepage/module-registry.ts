import type { ModuleSize, ModuleVisibility } from "@/types/database";

export interface ModuleDef {
  key: string;
  name: string;
  description: string;
  defaultSize: ModuleSize;
  allowedSizes: ModuleSize[];
  defaultConfig: Record<string, unknown>;
  forcedVisibility?: ModuleVisibility;
}

const REGISTRY = new Map<string, ModuleDef>();

export function registerModule(def: ModuleDef): void {
  REGISTRY.set(def.key, def);
}

export function getModuleDef(key: string): ModuleDef | undefined {
  return REGISTRY.get(key);
}

export function getAllModuleDefs(): ModuleDef[] {
  return Array.from(REGISTRY.values());
}

// ────────────────── Built-in registry entries ──────────────────
registerModule({
  key: "hero_slider",
  name: "Hero slider",
  description: "Diavoorstelling met titel, tekst, CTA en achtergrondafbeelding.",
  defaultSize: "2x1",
  allowedSizes: ["2x1"],
  defaultConfig: {
    autoplay: true,
    // Drie standaard slides die de tenant zelf kan aanpassen of verwijderen.
    slides: [
      {
        subtitle: "Welkom",
        title: "Welkom bij onze club",
        body: "Blijf op de hoogte van het laatste nieuws, evenementen en teamupdates.",
        cta_label: "",
        cta_url: "",
        background_image_url: "",
      },
      {
        subtitle: "Nieuws",
        title: "Lees wat er speelt",
        body: "Toernooien, trainingsupdates en verhalen van achter de schermen.",
        cta_label: "Bekijk nieuws",
        cta_url: "nieuws",
        background_image_url: "",
      },
      {
        subtitle: "Doe mee",
        title: "Schrijf je in voor een proefles",
        body: "Probeer een training en laat de academie je verder helpen.",
        cta_label: "Proefles aanvragen",
        cta_url: "proefles",
        background_image_url: "",
      },
    ],
  },
});

registerModule({
  key: "news_hero_slider",
  name: "Nieuws hero slider",
  description: "Hero-slider met de laatste nieuwsberichten als slides.",
  defaultSize: "2x1",
  allowedSizes: ["2x1"],
  defaultConfig: {
    autoplay: true,
    limit: 5,
    category_id: null,
  },
});

registerModule({
  key: "news",
  name: "Nieuws",
  description: "Toon de laatste nieuwsberichten.",
  defaultSize: "1x1",
  allowedSizes: ["1x1", "1x2", "2x1"],
  defaultConfig: { limit: 3, highlight_latest: true, category_id: null },
});

registerModule({
  key: "custom_content",
  name: "Eigen content",
  description: "Vrije tekstblok via de rich-text editor.",
  defaultSize: "1x1",
  allowedSizes: ["1x1", "1x2", "2x1"],
  defaultConfig: { content_html: "" },
});

registerModule({
  key: "video",
  name: "Video",
  description: "YouTube of Vimeo video embed.",
  defaultSize: "1x1",
  allowedSizes: ["1x1", "1x2", "2x1"],
  defaultConfig: { provider: "youtube", video_url: "", shortcode: "" },
});

registerModule({
  key: "cta",
  name: "Call to action",
  description: "Knopblok dat verwijst naar een interne of externe pagina.",
  defaultSize: "1x1",
  allowedSizes: ["1x1", "1x2", "2x1"],
  defaultConfig: { text: "", button_label: "", button_url: "" },
});

registerModule({
  key: "sponsors",
  name: "Sponsoren",
  description: "Toon sponsorlogo's in een raster of carrousel.",
  defaultSize: "2x1",
  allowedSizes: ["1x1", "1x2", "2x1"],
  defaultConfig: { display_mode: "grid", limit: 12 },
});

registerModule({
  key: "events_trainings",
  name: "Evenementen & trainingen",
  description: "Aankomende trainingen en events.",
  defaultSize: "1x1",
  allowedSizes: ["1x1", "1x2", "2x1"],
  defaultConfig: { limit: 5, show_attendance_status: false },
});

registerModule({
  key: "media_wall",
  name: "Media Wall",
  description: "Beeld en video wand.",
  defaultSize: "2x1",
  allowedSizes: ["1x1", "1x2", "2x1"],
  defaultConfig: { display_mode: "grid", limit: 9 },
});

registerModule({
  key: "personal_dashboard",
  name: "Persoonlijk dashboard",
  description: "Persoonlijk overzicht voor ingelogde gebruikers.",
  defaultSize: "1x2",
  allowedSizes: ["1x1", "1x2", "2x1"],
  defaultConfig: {
    show_next_training: true,
    show_latest_notifications: true,
    show_quick_actions: true,
  },
  forcedVisibility: "logged_in",
});

registerModule({
  key: "alerts_announcements",
  name: "Alerts & aankondigingen",
  description: "Toon actieve alerts en aankondigingen.",
  defaultSize: "2x1",
  allowedSizes: ["1x1", "1x2", "2x1"],
  defaultConfig: { show_alerts: true, show_announcements: true },
});

registerModule({
  key: "trainers",
  name: "Trainers",
  description: "Toon trainers met publieke bio.",
  defaultSize: "2x1",
  allowedSizes: ["1x1", "1x2", "2x1"],
  defaultConfig: { limit: 8, show_bio: true },
});

// Sprint 19: Social feed module
registerModule({
  key: "social_feed",
  name: "Social feed",
  description: "Toon recente community posts op de homepage.",
  defaultSize: "1x2",
  allowedSizes: ["1x1", "1x2", "2x1"],
  defaultConfig: { limit: 5, filter: "all" },
});

export const ALL_MODULE_KEYS = (): string[] => Array.from(REGISTRY.keys());
