import { FeatureDetailPage } from "@/components/marketing/feature-detail";
import { FEATURES } from "@/lib/marketing/site-data";

const FEATURE = FEATURES.find((f) => f.slug === "certificaten")!;

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
          title: "Van behaalde module naar diploma — automatisch",
          body: "Wanneer een sporter alle onderdelen van een module beheerst, kan NXTTRACK automatisch een diploma genereren in jullie clubstijl. Eén knop voor de trainer, een trotse sporter en een tevreden ouder.",
        },
        {
          title: "Templates die bij jouw club passen",
          body: "Eigen logo, kleuren en lay-out. Sportscholen, zwemscholen en academies krijgen direct herkenbare diploma's — geen generieke templates die niet bij jullie identiteit passen.",
        },
        {
          title: "Aanwezigheidsrapporten die staan",
          body: "Per lid, per groep of per maand een professioneel rapport. Bruikbaar voor subsidies, gemeentelijke aanvragen of intern verantwoording afleggen.",
        },
        {
          title: "Voortgangsrapporten als gespreksstof",
          body: "Voor coachgesprekken, ouderavonden of als afsluiting van een seizoen: een overzicht van behaalde modules en lopende ontwikkeling. Direct deelbaar of in te zetten als printbare PDF.",
        },
      ]}
      faq={[
        {
          question: "Kunnen we onze huidige diploma's omzetten?",
          answer:
            "Ja. We helpen tijdens de onboarding om jullie bestaande templates en lay-out om te zetten naar NXTTRACK-templates die automatisch gegenereerd worden.",
        },
        {
          question: "Kunnen ouders het diploma downloaden?",
          answer:
            "Ja. Diploma's en certificaten verschijnen in het profiel van de sporter en zijn als PDF te downloaden of fysiek uit te printen.",
        },
        {
          question: "Werkt dit ook voor meerdere niveaus, banden of graden?",
          answer:
            "Zeker — voor zwemdiploma's A/B/C, voor karategraden, voor gymniveaus of voor je eigen ontwikkelde leerlijn. Elke module = potentieel certificaat.",
        },
      ]}
    />
  );
}
