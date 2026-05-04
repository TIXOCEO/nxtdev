import { Sparkles } from "lucide-react";
import { Section, EyebrowHeading } from "@/components/marketing/section";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { CtaBlock } from "@/components/marketing/cta-block";

export const metadata = {
  title: "Prijzen",
  description:
    "Eerlijke prijzen voor verenigingen, academies en scholen. NXTTRACK schaalt mee met jullie organisatie — geen verborgen kosten.",
};

export default function PrijzenPage() {
  return (
    <>
      <Section size="md">
        <ScrollReveal>
          <EyebrowHeading
            as="h1"
            eyebrow="Eerlijke prijzen"
            title="Prijzen die meegroeien met jullie club."
            body="Onze prijsstructuur is altijd op maat — afhankelijk van het aantal leden, locaties en gewenste modules. Geen verborgen kosten, geen verrassingen."
            align="center"
          />
        </ScrollReveal>
      </Section>

      <Section size="md" className="!pt-0">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-10 text-center">
            <div className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent)]/20 text-[#3f5a08]">
              <Sparkles className="size-6" strokeWidth={1.75} />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">
              Pakketten worden binnenkort gedeeld.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              We werken aan een transparant overzicht van onze pakketten en
              prijzen. Heb je interesse of een specifieke vraag? Plan een
              vrijblijvend kennismakingsgesprek — dan bespreken we samen wat
              het beste past bij jullie club.
            </p>
          </div>
        </ScrollReveal>
      </Section>

      <Section size="md">
        <CtaBlock
          title="Benieuwd wat NXTTRACK voor jullie club kost?"
          body="Vraag vrijblijvend een offerte aan. Geen automatische verlengingen, geen verborgen kosten."
        />
      </Section>
    </>
  );
}
