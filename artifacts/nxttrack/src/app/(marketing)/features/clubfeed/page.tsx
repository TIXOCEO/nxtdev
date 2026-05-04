import { FeatureDetailPage } from "@/components/marketing/feature-detail";
import { FEATURES } from "@/lib/marketing/site-data";

const FEATURE = FEATURES.find((f) => f.slug === "clubfeed")!;

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
          title: "Een sociaal platform — maar dan veilig",
          body: "Geen open social media, geen ruis, geen zorgen over wie meeleest. De clubfeed leeft binnen jullie vereniging. Trainers en coördinatoren bepalen wie wat mag zien, plaatsen en delen. Volledig in lijn met moderne privacy-verwachtingen voor jeugd.",
        },
        {
          title: "Aparte feeds per team of clubbreed",
          body: "Een clubfeed voor het hele verenigingsnieuws, plus aparte feeds per team voor het dagelijks contact. Sporters zien automatisch de feeds waar ze in actief zijn — niet meer, niet minder.",
        },
        {
          title: "Reacties met grenzen",
          body: "Ouders feliciteren, teamgenoten reageren, trainers modereren. Per feed bepaal je of reacties open zijn of alleen voor specifieke rollen. Ongepaste reacties zijn met één klik verwijderd of gemute.",
        },
        {
          title: "Coach broadcast — één bericht, hele team",
          body: "Trainers sturen één bericht naar het hele team. Het verschijnt in de feed én als notificatie. Snelle communicatie die past bij het tempo van een seizoen.",
        },
      ]}
      faq={[
        {
          question: "Kunnen minderjarigen veilig in de feed?",
          answer:
            "Ja. NXTTRACK heeft ingebouwde regels voor jongere sporters: zichtbaarheid van naam en foto kan beperkt worden, en ouders krijgen volledige inzage in wat hun kind ziet en plaatst.",
        },
        {
          question: "Wat als iemand iets ongepasts plaatst?",
          answer:
            "Trainers en coördinatoren met moderatie-rechten verwijderen content direct, kunnen gebruikers dempen en in zwaardere gevallen blokkeren. Alle moderatie-acties worden gelogd.",
        },
        {
          question: "Kunnen we badges en behaalde diploma's automatisch in de feed laten verschijnen?",
          answer:
            "Ja. NXTTRACK kan automatisch achievement-posts plaatsen wanneer een sporter een badge of diploma behaalt — zo viert de hele club elk succes.",
        },
      ]}
    />
  );
}
