import { FeatureDetailPage } from "@/components/marketing/feature-detail";
import { FEATURES } from "@/lib/marketing/site-data";

const FEATURE = FEATURES.find((f) => f.slug === "communicatie")!;

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
          title: "Notificaties die er toe doen",
          body: "Per gebeurtenis en per gebruiker stelbaar: nieuwe berichten, agenda-wijzigingen, behaalde badges, voortgang of clubaankondigingen. Leden bepalen zelf welke notificaties ze willen — geen onnodige meldingen, wel de juiste op het juiste moment.",
        },
        {
          title: "Nieuwsbrieven met een ingebouwde editor",
          body: "Bouw nieuwsbrieven met onze TipTap-gebaseerde editor: rich text, afbeeldingen, knoppen en koppelingen naar evenementen of feeds. Verstuur naar de hele club, een team of een specifieke doelgroep.",
        },
        {
          title: "Directe berichten — binnen één platform",
          body: "Trainers en coördinatoren chatten 1-op-1 of in groepen. Sporters en ouders bereiken hun trainer zonder buiten het platform om te gaan. Alle communicatie blijft binnen jullie clubomgeving.",
        },
        {
          title: "Native PWA — geen app store nodig",
          body: "Volledige Progressive Web App: leden installeren NXTTRACK in seconden op iPhone of Android, zonder app store of update-discipline. Bij elke release zien ze direct de nieuwste versie.",
        },
      ]}
      faq={[
        {
          question: "Kunnen we onze huisstijl gebruiken in nieuwsbrieven?",
          answer:
            "Ja. Logo, kleuren en koptekst worden automatisch toegepast op alle uitgaande mails en nieuwsbrieven. Trainers en bestuur sturen mailings die er onmiskenbaar van jullie club zijn.",
        },
        {
          question: "Worden de nieuwsbrieven ook verstuurd naar niet-leden?",
          answer:
            "Standaard alleen naar leden en hun ouders. Optioneel kun je externe abonnees toevoegen (bijvoorbeeld voor een algemene clubnieuwsbrief). Volledig AVG-conform met opt-in.",
        },
        {
          question: "Wat gebeurt er met privé-gegevens in chats?",
          answer:
            "Alle berichten zijn opgeslagen binnen jullie tenantruimte en alleen toegankelijk voor de personen die er deel van uitmaken. Trainers en bestuur kunnen op verzoek inzage geven aan ouders van minderjarigen.",
        },
      ]}
    />
  );
}
