import { Section, EyebrowHeading } from "@/components/marketing/section";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { CtaBlock } from "@/components/marketing/cta-block";
import { IconFramePlaceholder } from "@/components/marketing/icon-frame";
import { Compass, HeartHandshake, Sparkles, Users } from "lucide-react";

export const metadata = {
  title: "Over ons",
  description:
    "NXTTRACK is gebouwd door mensen met een hart voor sport en techniek. Lees waarom we doen wat we doen.",
};

const VALUES = [
  {
    icon: HeartHandshake,
    title: "De sporter centraal",
    body: "We bouwen niet voor administratie. We bouwen voor sporters die willen groeien — en de mensen om hen heen.",
  },
  {
    icon: Sparkles,
    title: "Zonder prestatiedruk",
    body: "Ranglijsten? Onderlinge vergelijking? Niet bij ons. Iedere sporter loopt zijn of haar eigen pad.",
  },
  {
    icon: Compass,
    title: "Eenvoud boven alles",
    body: "Een platform mag krachtig zijn, maar nooit complex aanvoelen. Trainers, ouders en sporters moeten direct mee kunnen.",
  },
  {
    icon: Users,
    title: "Samen met clubs",
    body: "Onze beste features komen van vragen uit het veld. We bouwen NXTTRACK met de verenigingen die het gebruiken.",
  },
];

export default function OverOnsPage() {
  return (
    <>
      <Section size="md">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <ScrollReveal>
            <EyebrowHeading
              as="h1"
              eyebrow="Over NXTTRACK"
              title="Geen tool. Een platform met een verhaal."
              body="NXTTRACK is ontstaan uit jaren ervaring binnen sportverenigingen — als trainer, ouder en bestuurder. We zagen losse systemen, spreadsheets en versnipperde apps. En we wisten: dit kan beter."
            />
          </ScrollReveal>
          <ScrollReveal delay={0.05}>
            <IconFramePlaceholder
              icon={HeartHandshake}
              label="Onze missie"
              ratio="square"
              tone="lime"
            />
          </ScrollReveal>
        </div>
      </Section>

      <Section tone="soft" size="md">
        <ScrollReveal>
          <EyebrowHeading
            eyebrow="Onze waarden"
            title="Waar wij in geloven."
            align="center"
          />
        </ScrollReveal>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {VALUES.map((v, idx) => (
            <ScrollReveal key={v.title} delay={idx * 0.05}>
              <div className="rounded-3xl bg-white p-7 border border-[var(--surface-border)] h-full">
                <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[#3f5a08]">
                  <v.icon className="size-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">
                  {v.title}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-[var(--text-secondary)]">
                  {v.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Section>

      <Section size="md">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl">
            <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
              Hoe we te werk gaan
            </h3>
            <div className="prose prose-neutral mt-6 max-w-none text-[var(--text-secondary)]">
              <p>
                We werken in korte lijnen. Geen lange ketens van accountmanagers,
                geen bureaucratisch onboardingstraject — wel een echte gesprekspartner
                die snapt wat een vereniging dagelijks doormaakt.
              </p>
              <p>
                Onze ontwikkelaars en designers bouwen NXTTRACK met dezelfde zorg waarmee
                trainers met sporters omgaan: stap voor stap, met aandacht voor detail
                en altijd vanuit een doel. Iedere release maakt het platform beter,
                veiliger en mooier.
              </p>
              <p>
                We zijn klein, wendbaar en gefocust. Dat zorgt ervoor dat jullie wensen
                snel landen in het product — en dat we eerlijk kunnen zeggen wanneer iets
                niet past. Want NXTTRACK is geen one-size-fits-all. Het is een platform
                dat past bij jouw sport en jouw club.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </Section>

      <Section size="md">
        <CtaBlock
          title="Benieuwd wat we voor jullie kunnen betekenen?"
          body="Een kennismakingsgesprek kost je 30 minuten — en levert mogelijk veel meer op."
        />
      </Section>
    </>
  );
}
