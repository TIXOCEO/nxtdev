import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SITE } from "@/lib/marketing/site-data";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "clubsoftware",
    "leerlingvolgsysteem",
    "sportvereniging software",
    "zwemschool software",
    "sportschool software",
    "ledenadministratie",
    "sport academie",
    "vechtsportschool",
    "diploma's automatisch",
    "clubapp",
    "PWA voor sportclubs",
    "NXTTRACK",
  ],
  authors: [{ name: "NXTTRACK" }],
  openGraph: {
    type: "website",
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    locale: "nl_NL",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[var(--text-primary)]">
      {/*
        De globale stylesheet zet `html, body { height:100%; overflow:hidden }`
        voor de platform-/tenant-app shells. Op de marketing-pagina's moet de
        pagina vrij kunnen scrollen — onderstaande override hersteld dit
        zonder de andere routes te raken.
      */}
      <style>{`html, body { height: auto; overflow: visible; }`}</style>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
