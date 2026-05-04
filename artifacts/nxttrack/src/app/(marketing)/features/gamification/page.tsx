import { FeatureDetailPage } from "@/components/marketing/feature-detail";
import { FEATURES } from "@/lib/marketing/site-data";

const FEATURE = FEATURES.find((f) => f.slug === "gamification")!;

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
          title: "Erkenning, niet competitie",
          body: "NXTTRACK toont vooruitgang en motivatie — geen ranglijsten van wie er beter is dan een ander. Sporters worden beloond voor hun eigen pad. Een sporter die 10 trainingen op rij komt verdient dezelfde erkenning als de techniek-master.",
        },
        {
          title: "Custom badges in jouw clubstijl",
          body: "Ontwerp eigen badges met je eigen iconografie en kleuren. Trainers kennen ze handmatig toe of laten NXTTRACK het automatisch doen op basis van behaalde modules, aanwezigheid of streaks.",
        },
        {
          title: "Streaks die consistent gedrag belonen",
          body: "Een streak voor wekelijkse aanwezigheid. Een streak voor een doel waar elke training aan gewerkt wordt. Streaks maken inzet zichtbaar — en geven sporters een reden om door te zetten op moeilijke dagen.",
        },
        {
          title: "Team-challenges versterken het clubgevoel",
          body: "Maak uitdagingen die het hele team samen aanpakt. Een minimum aantal trainingen per maand, een gezamenlijk klim-doel of een themaweek. Samenwerken aan een doel maakt seizoenen tot een gedeelde reis.",
        },
      ]}
      faq={[
        {
          question: "Worden ouders niet te competitief?",
          answer:
            "Bewust ontwerp: niemand kan badges of streaks van anderen vergelijken. Het profiel toont alleen de eigen reis. Daardoor blijft motivatie persoonlijk en gezond.",
        },
        {
          question: "Kunnen we badges ook handmatig toekennen?",
          answer:
            "Ja. Trainers en coördinatoren kunnen handmatig badges geven — bijvoorbeeld voor sportief gedrag, leiderschap of een mooi moment dat NXTTRACK niet automatisch ziet.",
        },
        {
          question: "Kunnen we badges later toevoegen of aanpassen?",
          answer:
            "Altijd. Badges zijn data — geen vaste set. Je voegt ze toe, past ze aan en archiveert ze wanneer dat past bij jullie clubseizoen.",
        },
      ]}
    />
  );
}
