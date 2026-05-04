import { FeatureDetailPage } from "@/components/marketing/feature-detail";
import { FEATURES } from "@/lib/marketing/site-data";

const FEATURE = FEATURES.find((f) => f.slug === "ledenbeheer")!;

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
          title: "Eén overzicht voor leden, ouders en kinderen",
          body: "Familieaccounts maken het mogelijk om meerdere kinderen onder één ouder te beheren. Inschrijven, contributie en communicatie blijven helder, ook als één gezin twee of drie sporters in de club heeft.",
        },
        {
          title: "Slimme planning per team en trainer",
          body: "Trainingen, wedstrijden, evenementen en proeflessen — allemaal in één agenda, gefilterd op team, trainer of locatie. Trainers zien hun eigen agenda; coördinatoren zien het hele plaatje.",
        },
        {
          title: "Aanwezigheid in één tik",
          body: "Trainers vinken aan wie er was — met de telefoon op de baan, op het veld of in de zaal. Geen achteraf-bijhouden in spreadsheets meer. Maandrapporten, seizoensoverzichten en signaleringen zijn meteen beschikbaar.",
        },
        {
          title: "Contributie helder voor de penningmeester",
          body: "Per lid zie je openstaande en betaalde contributie. Reminders zijn automatisch te versturen. Direct gekoppelde betaalintegraties zijn onderdeel van de roadmap.",
        },
      ]}
      faq={[
        {
          question: "Kunnen we leden in groepen en teams indelen?",
          answer:
            "Ja, en zo gedetailleerd als je wilt: groepen per leeftijd of niveau, teams per seizoen, trainingsgroepen per dagdeel. Een lid kan in meerdere groepen of teams zitten.",
        },
        {
          question: "Werkt aanwezigheid ook offline?",
          answer:
            "De PWA werkt offline-first voor aanwezigheid. Een trainer zonder ontvangst tikt aan wie er was; bij verbinding wordt het automatisch gesynct.",
        },
        {
          question: "Kunnen ouders zelf hun gegevens beheren?",
          answer:
            "Ja. Ouders hebben een eigen profiel waar ze adresgegevens, telefoonnummer en allergie/medische info kunnen bijwerken — wat het bestuur veel werk uit handen neemt.",
        },
      ]}
    />
  );
}
