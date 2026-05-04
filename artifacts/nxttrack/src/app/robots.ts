import type { MetadataRoute } from "next";
import { SITE } from "@/lib/marketing/site-data";

export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/platform", "/api/", "/t/*/profile", "/t/*/settings"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
