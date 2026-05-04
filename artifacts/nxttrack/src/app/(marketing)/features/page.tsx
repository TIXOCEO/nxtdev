import { Section, EyebrowHeading } from "@/components/marketing/section";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { FeatureCard } from "@/components/marketing/feature-card";
import { CtaBlock } from "@/components/marketing/cta-block";
import { IconFramePlaceholder } from "@/components/marketing/icon-frame";
import { FEATURES, TRUST_POINTS } from "@/lib/marketing/site-data";

export const metadata = {
  title: "Alle features",
  description:
    "Ontdek alle modules van NXTTRACK: leerlingvolgsysteem, gamification, clubfeed, ledenbeheer, certificaten en communicatie. Eén platform voor de hele vereniging.",
};

export default function FeaturesPage() {
  return (
    <>
      <Section size="lg">
        <ScrollReveal>
          <EyebrowHeading
            as="h1"
            eyebrow="Productoverzicht"
            title="Eén platform. Alles wat jouw club nodig heeft."
            body="NXTTRACK bestaat uit zes nauw samenwerkende kernmodules. Klik door naar elke module voor de details — of bekijk hieronder de complete lijst."
            align="center"
          />
        </ScrollReveal>

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, idx) => (
            <ScrollReveal key={f.slug} delay={idx * 0.05}>
              <FeatureCard
                icon={f.icon}
                title={f.title}
                body={f.short}
                href={f.href}
              />
            </ScrollReveal>
          ))}
        </div>
      </Section>

      <Section tone="soft" size="lg">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <ScrollReveal>
            <IconFramePlaceholder
              icon={FEATURES[3].icon}
              label="Ledenbeheer"
              ratio="tall"
              tone="lime"
            />
          </ScrollReveal>
          <ScrollReveal delay={0.05}>
            <EyebrowHeading
              eyebrow="Eén systeem, één waarheid"
              title="Geen losse tools meer. Geen verspreide data."
              body="NXTTRACK vervangt spreadsheets, losse apps voor planning, mailtools voor nieuwsbrieven en aparte systemen voor diploma's. Alles wat je nodig hebt staat onder één dak."
            />
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {TRUST_POINTS.map((p) => (
                <div key={p.title} className="flex gap-3">
                  <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[#3f5a08]">
                    <p.icon className="size-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {p.title}
                    </div>
                    <div className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {p.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </Section>

      <Section size="md">
        <ScrollReveal>
          <CtaBlock
            title="Welke module past het best bij jullie club?"
            body="In een kennismakingsgesprek bespreken we welke modules direct waarde toevoegen en waar je later mee verder kunt. Geen verkooppraatje — wel een eerlijke kijk."
          />
        </ScrollReveal>
      </Section>
    </>
  );
}
