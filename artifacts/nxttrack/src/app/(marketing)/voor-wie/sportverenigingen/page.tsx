import { SectorDetailPage } from "@/components/marketing/sector-detail";
import { SECTORS } from "@/lib/marketing/site-data";

const SECTOR = SECTORS.find((s) => s.slug === "sportverenigingen")!;

export const metadata = {
  title: SECTOR.title,
  description: SECTOR.hero,
};

export default function Page() {
  return (
    <SectorDetailPage
      sector={SECTOR}
      intro={SECTOR.hero}
      spotlightFeatureSlugs={["leerlingvolgsysteem", "ledenbeheer", "clubfeed"]}
      scenario={[
        {
          title: "Voor het seizoen begint",
          body: "Bestuur en coördinatoren zetten teams op, koppelen trainers en sturen één heldere uitnodiging naar leden om in te schrijven. Contributie en aanwezigheidsregels staan klaar.",
        },
        {
          title: "Tijdens een trainingsweek",
          body: "Trainers vinken aanwezigheid af, leggen voortgang vast en plaatsen een mooi moment in de teamfeed. Ouders zien wat hun kind heeft gedaan — zonder dat trainers een aparte WhatsApp-update hoeven sturen.",
        },
        {
          title: "Na een wedstrijdweekend",
          body: "Een coach broadcast naar de hele groep, foto's in de clubfeed en automatische badges voor wedstrijdmomenten. De club leeft, zonder dat het bestuur uren bezig is.",
        },
        {
          title: "Aan het eind van het seizoen",
          body: "Een seizoensoverzicht per speler, automatische diploma's voor leerlijnen die afgerond zijn, en een rustig overzicht voor het bestuur over groei, aanwezigheid en ledenbinding.",
        },
      ]}
    />
  );
}
