import { FeatureDetailPage } from "@/components/marketing/feature-detail";
import { FEATURES } from "@/lib/marketing/site-data";

const FEATURE = FEATURES.find((f) => f.slug === "leerlingvolgsysteem")!;

export const metadata = {
  title: FEATURE.title,
  description: FEATURE.long,
};

export default function Page() {
  return (
    <FeatureDetailPage
      feature={FEATURE}
      intro={FEATURE.long}
      story={[
        {
          title: "Bouw je eigen leerlijn — zonder beperkingen",
          body: "NXTTRACK legt geen vast model op. Categorieën, modules en onderdelen ontwerp je zelf. Zwemschool? Diploma A wordt een module met onderdelen voor watervrij maken, schoolslag, rugslag en sprongen. Vechtsport? Witte band tot zwarte band. Voetbal? Techniek, tactiek, fysiek per leeftijdsgroep.",
        },
        {
          title: "Drie beoordelingsstijlen — altijd passend",
          body: "Op modulair niveau bepaal je hoe trainers voortgang aangeven: tekstueel voor genuanceerde feedback, sterren voor een snelle indicatie, of emoji's voor een speelse uitstraling bij jongere groepen. Stijlen zijn mengbaar — een serieuze techniek-module met sterren, naast een fun-onderdeel met emoji's.",
        },
        {
          title: "Voortgang die motiveert",
          body: "Sporters en ouders zien per module precies hoever ze zijn. Geen ranglijsten, geen vergelijking met andere leden — wel een duidelijke route en helder zicht op wat de volgende stap is. Dat motiveert en zorgt voor rust.",
        },
        {
          title: "Geschiedenis blijft bewaard",
          body: "Stroomt een sporter door naar een ouder team of een nieuw niveau? De voortgang start opnieuw, maar het hele profiel blijft bestaan. Coaches en talentscouts kunnen meerjarige groei zien — een unieke mogelijkheid bij talentontwikkeling.",
        },
      ]}
      faq={[
        {
          question: "Kunnen we onze bestaande leerlijn overzetten?",
          answer:
            "Ja. We helpen bij de onboarding zodat je bestaande structuur direct werkt in NXTTRACK. Heb je een PDF of Excel? Vaak kunnen we dit grotendeels automatisch importeren.",
        },
        {
          question: "Hoeveel modules en onderdelen kunnen we maken?",
          answer:
            "Onbeperkt. Bouw zo simpel of zo gedetailleerd als jullie willen werken. We zien clubs met 5 modules én clubs met meer dan 200.",
        },
        {
          question: "Kunnen verschillende teams een eigen leerlijn hebben?",
          answer:
            "Ja. Per team of groep kies je welke modules van toepassing zijn. Een talentprogramma heeft andere doelen dan een recreatieve groep.",
        },
        {
          question: "Wie kan voortgang invullen?",
          answer:
            "Trainers en coördinatoren met de juiste rol. Per module bepaalt de club wie wat mag. Sporters en ouders kunnen alleen lezen — geen zelfevaluaties die het zicht vertroebelen.",
        },
      ]}
    />
  );
}
