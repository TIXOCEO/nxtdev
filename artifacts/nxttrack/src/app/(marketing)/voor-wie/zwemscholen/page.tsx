import { SectorDetailPage } from "@/components/marketing/sector-detail";
import { SECTORS } from "@/lib/marketing/site-data";

const SECTOR = SECTORS.find((s) => s.slug === "zwemscholen")!;

export const metadata = {
  title: SECTOR.title,
  description: SECTOR.hero,
};

export default function Page() {
  return (
    <SectorDetailPage
      sector={SECTOR}
      intro={SECTOR.hero}
      spotlightFeatureSlugs={["leerlingvolgsysteem", "certificaten", "communicatie"]}
      scenario={[
        {
          title: "Tijdens een les",
          body: "De badmeester opent NXTTRACK op de tablet aan de rand van het bad. Per kind wordt afgevinkt welk onderdeel die les is geoefend — schoolslag, watertrappen, sprongen. Voortgang is direct zichtbaar.",
        },
        {
          title: "Vlak voor het diploma-moment",
          body: "Wanneer alle onderdelen van een diploma behaald zijn, genereert NXTTRACK automatisch het certificaat in jullie clubstijl. Klaar om uit te reiken — geen handmatig invullen meer.",
        },
        {
          title: "Voor ouders thuis",
          body: "Ouders zien in de app precies welke onderdelen hun kind beheerst en welke nog komen. Geen vage berichten over 'het gaat goed' — wel concrete voortgang.",
        },
        {
          title: "Voor de organisatie",
          body: "Wachtlijsten, proeflesaanmeldingen en abonnementen worden centraal beheerd. Communicatie naar ouders gebeurt via één platform — geen losse mailtools meer nodig.",
        },
      ]}
    />
  );
}
