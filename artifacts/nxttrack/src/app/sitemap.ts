import type { MetadataRoute } from "next";
import { FEATURES, SECTORS, SITE } from "@/lib/marketing/site-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes = [
    "/",
    "/features",
    "/voor-wie",
    "/voor-sporters",
    "/prijzen",
    "/roadmap",
    "/over-ons",
    "/contact",
  ];

  const featureRoutes = FEATURES.map((f) => f.href);
  const sectorRoutes = SECTORS.map((s) => s.href);

  return [...staticRoutes, ...featureRoutes, ...sectorRoutes].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
