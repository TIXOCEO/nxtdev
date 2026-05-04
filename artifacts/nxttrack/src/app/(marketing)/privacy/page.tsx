import Link from "next/link";
import { Section } from "@/components/marketing/section";
import { SITE } from "@/lib/marketing/site-data";

export const metadata = {
  title: "Privacy",
  description:
    "Privacyverklaring van NXTTRACK. We leggen uit welke gegevens we verzamelen en hoe we die zorgvuldig behandelen.",
};

export default function PrivacyPage() {
  return (
    <Section size="md">
      <article className="mx-auto max-w-3xl prose-marketing">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[var(--text-primary)]">
          Privacyverklaring
        </h1>
        <p className="mt-4 text-sm uppercase tracking-wider text-[var(--text-secondary)]">
          Laatst bijgewerkt: {new Date().toLocaleDateString("nl-NL", { year: "numeric", month: "long" })}
        </p>

        <div className="mt-10 space-y-8 text-[var(--text-secondary)] leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              1. Wie zijn wij?
            </h2>
            <p className="mt-3">
              NXTTRACK is een Nederlands clubplatform voor sportverenigingen, zwemscholen,
              sportscholen, academies, dans- en vechtsportscholen. We zijn verantwoordelijk
              voor de verwerking van persoonsgegevens via onze website {SITE.url}.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              2. Welke gegevens verwerken we?
            </h2>
            <p className="mt-3">
              Wanneer je het kennismakingsformulier invult, verwerken we je naam, e-mailadres,
              naam van je organisatie, optionele functie en de inhoud van je bericht. Deze
              gegevens gebruiken we uitsluitend om contact met je op te nemen over je aanvraag.
            </p>
            <p className="mt-3">
              Voor het functioneren van de website gebruiken we geen tracking-cookies. Eventuele
              technische cookies dienen alleen voor sessiebeheer en beveiliging.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              3. Hoe lang bewaren we je gegevens?
            </h2>
            <p className="mt-3">
              Aanvragen via het kennismakingsformulier bewaren we maximaal 24 maanden, tenzij
              een actieve klantrelatie ontstaat. Op verzoek verwijderen we je gegevens eerder.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              4. Jouw rechten
            </h2>
            <p className="mt-3">
              Je hebt recht op inzage, correctie, verwijdering en bezwaar tegen verwerking van
              je persoonsgegevens. Stuur een bericht naar{" "}
              <a href={`mailto:${SITE.email}`} className="text-[#3f5a08] underline">
                {SITE.email}
              </a>{" "}
              en we reageren binnen 5 werkdagen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              5. Beveiliging
            </h2>
            <p className="mt-3">
              We werken met versleutelde verbindingen (TLS), gehoste infrastructuur in de EU en
              passende organisatorische maatregelen om je gegevens te beschermen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              6. Vragen?
            </h2>
            <p className="mt-3">
              Neem gerust contact met ons op via{" "}
              <a href={`mailto:${SITE.email}`} className="text-[#3f5a08] underline">
                {SITE.email}
              </a>{" "}
              of via ons{" "}
              <Link href="/contact" className="text-[#3f5a08] underline">
                contactformulier
              </Link>
              .
            </p>
          </section>
        </div>
      </article>
    </Section>
  );
}
