import { SectorDetailPage } from "@/components/marketing/sector-detail";
import { SECTORS } from "@/lib/marketing/site-data";

const SECTOR = SECTORS.find((s) => s.slug === "sportscholen")!;

export const metadata = {
  title: SECTOR.title,
  description: SECTOR.hero,
};

export default function Page() {
  return (
    <SectorDetailPage
      sector={SECTOR}
      intro={SECTOR.hero}
      spotlightFeatureSlugs={["ledenbeheer", "communicatie", "gamification"]}
      scenario={[
        {
          title: "Bij binnenkomst",
          body: "Leden zien in de app de groepslessen van vandaag, kunnen direct aanmelden en ontvangen een herinnering vlak voor de les begint.",
        },
        {
          title: "Tijdens persoonlijke begeleiding",
          body: "PT's leggen per training de voortgang vast op het persoonlijke schema. Leden zien hun ontwikkeling en behaalde mijlpalen — wat motivatie en retentie verhoogt.",
        },
        {
          title: "Communicatie en evenementen",
          body: "Een nieuw groepsleslooster, een sluiting tijdens de feestdagen, een evenement — leden krijgen het direct via push of e-mail. Geen papieren mededelingen meer aan de muur.",
        },
        {
          title: "Inzicht voor de eigenaar",
          body: "Aanwezigheid, contributie en deelname-statistieken zijn realtime beschikbaar. Beslissingen over uitbreiding of aanpassing van het rooster worden gestut door echte data.",
        },
      ]}
    />
  );
}
