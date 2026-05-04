import { SectorDetailPage } from "@/components/marketing/sector-detail";
import { SECTORS } from "@/lib/marketing/site-data";

const SECTOR = SECTORS.find((s) => s.slug === "dansscholen")!;

export const metadata = {
  title: SECTOR.title,
  description: SECTOR.hero,
};

export default function Page() {
  return (
    <SectorDetailPage
      sector={SECTOR}
      intro={SECTOR.hero}
      spotlightFeatureSlugs={["leerlingvolgsysteem", "certificaten", "clubfeed"]}
      scenario={[
        {
          title: "Tijdens een les",
          body: "Docenten en sensei's leggen per leerling vast welke technieken en oefeningen beheerst worden. Bij dans: choreografieën, stijlen, niveaus. Bij vechtsport: technieken, vormen, sparring.",
        },
        {
          title: "Bij een examenmoment",
          body: "Wanneer alle vereiste technieken voor een nieuwe band of graad behaald zijn, is examen-readiness duidelijk zichtbaar. Diploma's en bandcertificaten worden automatisch in clubstijl gegenereerd.",
        },
        {
          title: "Voor optredens en demo's",
          body: "Plan optredens, repetities en showmomenten. Foto's en video's komen in de clubfeed — een mooi archief van mooie momenten dat sporters trots houdt.",
        },
        {
          title: "Voor ouders van jonge dansers en vechters",
          body: "Inzicht in voortgang, examenmomenten en showdata. Geen losse appjes, geen briefjes mee naar huis — alles centraal in NXTTRACK.",
        },
      ]}
    />
  );
}
