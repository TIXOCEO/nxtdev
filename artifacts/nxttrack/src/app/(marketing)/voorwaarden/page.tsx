import Link from "next/link";
import { Section } from "@/components/marketing/section";
import { SITE } from "@/lib/marketing/site-data";

export const metadata = {
  title: "Voorwaarden",
  description:
    "Algemene voorwaarden voor het gebruik van NXTTRACK door verenigingen, scholen en organisaties.",
};

export default function VoorwaardenPage() {
  return (
    <Section size="md">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[var(--text-primary)]">
          Algemene voorwaarden
        </h1>
        <p className="mt-4 text-sm uppercase tracking-wider text-[var(--text-secondary)]">
          Laatst bijgewerkt: {new Date().toLocaleDateString("nl-NL", { year: "numeric", month: "long" })}
        </p>

        <div className="mt-10 space-y-8 text-[var(--text-secondary)] leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              1. Toepasselijkheid
            </h2>
            <p className="mt-3">
              Deze voorwaarden zijn van toepassing op het gebruik van het NXTTRACK-platform
              (
              <a href={SITE.url} className="text-[#3f5a08] underline">
                {SITE.url}
              </a>
              ) en alle bijbehorende diensten, geleverd aan verenigingen, scholen en andere
              sport-gerelateerde organisaties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              2. Dienstverlening
            </h2>
            <p className="mt-3">
              NXTTRACK biedt een online platform voor leerlingvolgsysteem, ledenbeheer,
              communicatie, gamification en aanverwante functionaliteit. We spannen ons in voor
              een hoge beschikbaarheid, maar kunnen geen 100% uptime garanderen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              3. Gebruik van het platform
            </h2>
            <p className="mt-3">
              De klant gebruikt het platform conform de afgesproken doeleinden en draagt zorg
              voor zorgvuldig gebruik door eigen medewerkers, vrijwilligers en leden.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              4. Tarieven en facturatie
            </h2>
            <p className="mt-3">
              Tarieven worden per organisatie vastgesteld op basis van het aantal leden en de
              gewenste modules. Facturen worden maandelijks of per jaar gestuurd, conform de
              individuele overeenkomst.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              5. Privacy en gegevensbescherming
            </h2>
            <p className="mt-3">
              Voor de wijze waarop we persoonsgegevens verwerken, verwijzen we naar onze{" "}
              <Link href="/privacy" className="text-[#3f5a08] underline">
                privacyverklaring
              </Link>
              . Bij gebruik door organisaties sluiten we een verwerkersovereenkomst.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              6. Aansprakelijkheid
            </h2>
            <p className="mt-3">
              Onze aansprakelijkheid is beperkt tot directe schade en tot maximaal het bedrag
              dat de klant in de twaalf maanden voorafgaand aan het schadeveroorzakend feit
              aan NXTTRACK heeft betaald.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              7. Toepasselijk recht
            </h2>
            <p className="mt-3">
              Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden
              voorgelegd aan de bevoegde rechter in het arrondissement waar NXTTRACK gevestigd
              is.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              8. Vragen?
            </h2>
            <p className="mt-3">
              Voor vragen over deze voorwaarden:{" "}
              <a href={`mailto:${SITE.email}`} className="text-[#3f5a08] underline">
                {SITE.email}
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </Section>
  );
}
