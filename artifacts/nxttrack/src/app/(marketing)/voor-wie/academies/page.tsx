import { SectorDetailPage } from "@/components/marketing/sector-detail";
import { SECTORS } from "@/lib/marketing/site-data";

const SECTOR = SECTORS.find((s) => s.slug === "academies")!;

export const metadata = {
  title: SECTOR.title,
  description: SECTOR.hero,
};

export default function Page() {
  return (
    <SectorDetailPage
      sector={SECTOR}
      intro={SECTOR.hero}
      spotlightFeatureSlugs={["leerlingvolgsysteem", "gamification", "certificaten"]}
      scenario={[
        {
          title: "Bij talentdetectie",
          body: "Tijdens scoutingdagen leggen coaches per kandidaat eerste observaties vast. Het profiel volgt het talent vanaf de allereerste training.",
        },
        {
          title: "Tijdens de academieperiode",
          body: "Meerdere coaches leggen voortgang vast op verschillende disciplines: techniek, fysiek, mentaal, tactisch. Het profiel wordt rijker en meer onderbouwd.",
        },
        {
          title: "Bij doorstroom naar een ouder team",
          body: "Het talent stroomt door, NXTTRACK reset de voortgang voor de nieuwe context — maar bewaart de volledige geschiedenis. Coaches zien meerjarige ontwikkeling.",
        },
        {
          title: "Bij scouts en stafbeoordelingen",
          body: "Geautoriseerde scouts en stafleden zien dezelfde data. Geen versnipperde notities, geen losse rapportjes meer. Eén bron van waarheid voor talentbeleid.",
        },
      ]}
    />
  );
}
