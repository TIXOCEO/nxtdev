import {
  HeartHandshake,
  Bell,
  Trophy,
  LineChart,
  Smartphone,
  Lock,
  Star,
  CalendarDays,
  Rss,
} from "lucide-react";
import { Section, EyebrowHeading } from "@/components/marketing/section";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { IconFramePlaceholder } from "@/components/marketing/icon-frame";
import { CtaBlock } from "@/components/marketing/cta-block";
import { FeatureCard } from "@/components/marketing/feature-card";

export const metadata = {
  title: "Voor sporters & ouders",
  description:
    "Hoe NXTTRACK eruit ziet voor sporters en ouders: een veilige clubomgeving met heldere voortgang, leuke badges en directe communicatie met de club.",
};

const ATHLETE_BENEFITS = [
  {
    icon: LineChart,
    title: "Zie je eigen voortgang",
    body: "Per module zie je precies wat je beheerst en wat de volgende stap is. Geen cijfers, geen ranglijsten — wel duidelijke groei.",
  },
  {
    icon: Trophy,
    title: "Verdien badges",
    body: "Voor inzet, consistentie en mooie momenten. Een eigen profiel met al je behaalde mijlpalen.",
  },
  {
    icon: Rss,
    title: "Volg de clubfeed",
    body: "Mooie momenten, prestaties van teamgenoten en clubaankondigingen — alles in één veilige feed.",
  },
  {
    icon: CalendarDays,
    title: "Altijd de juiste agenda",
    body: "Wanneer is de volgende training? Wat staat er deze maand op de planning? Eén tik in de app.",
  },
];

const PARENT_BENEFITS = [
  {
    icon: HeartHandshake,
    title: "Inzicht zonder gedoe",
    body: "Zie de ontwikkeling van je kind, zonder eindeloze nieuwsbrieven of WhatsApp-groepen.",
  },
  {
    icon: Bell,
    title: "Notificaties die er toe doen",
    body: "Belangrijke updates: een nieuw diploma, een uitgevallen training of een prachtig moment in de feed.",
  },
  {
    icon: Lock,
    title: "Veilig voor jeugd",
    body: "NXTTRACK voldoet aan moderne privacy-regels en is ontworpen met de veiligheid van minderjarigen voorop.",
  },
  {
    icon: Smartphone,
    title: "Werkt op elk apparaat",
    body: "Installeer NXTTRACK als app op je telefoon — zonder app store. Werkt op iPhone, Android, tablet en computer.",
  },
];

export default function VoorSportersPage() {
  return (
    <>
      <Section size="md">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <ScrollReveal>
            <EyebrowHeading
              as="h1"
              eyebrow="Voor sporters & ouders"
              title="Plezier, motivatie en erkenning bij elke stap die je zet."
              body="NXTTRACK is geen administratiesysteem. Het is een platform waar jij — of je kind — zichzelf ziet groeien. Stap voor stap, op een manier die past bij je eigen tempo."
            />
          </ScrollReveal>
          <ScrollReveal delay={0.05}>
            <IconFramePlaceholder
              icon={Star}
              label="Jouw profiel"
              ratio="tall"
              tone="lime"
            />
          </ScrollReveal>
        </div>
      </Section>

      <Section tone="soft" size="md">
        <ScrollReveal>
          <EyebrowHeading
            eyebrow="Voor sporters"
            title="Jouw ontwikkeling, jouw verhaal."
          />
        </ScrollReveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {ATHLETE_BENEFITS.map((b, idx) => (
            <ScrollReveal key={b.title} delay={idx * 0.05}>
              <FeatureCard icon={b.icon} title={b.title} body={b.body} />
            </ScrollReveal>
          ))}
        </div>
      </Section>

      <Section size="md">
        <ScrollReveal>
          <EyebrowHeading
            eyebrow="Voor ouders"
            title="Vertrouwen, inzicht en rust."
          />
        </ScrollReveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {PARENT_BENEFITS.map((b, idx) => (
            <ScrollReveal key={b.title} delay={idx * 0.05}>
              <FeatureCard icon={b.icon} title={b.title} body={b.body} />
            </ScrollReveal>
          ))}
        </div>
      </Section>

      <Section tone="accent" size="md">
        <ScrollReveal>
          <EyebrowHeading
            eyebrow="Privacy & veiligheid"
            title="Speciaal ontworpen met jeugd in gedachten."
            body="NXTTRACK volgt strikte regels rond zichtbaarheid van minderjarige sporters. Trainers en clubs bepalen wie wat mag zien — geen open social media, geen onbedoelde delingen."
            align="center"
          />
        </ScrollReveal>
      </Section>

      <Section size="md">
        <CtaBlock
          eyebrow="Vertel het je club"
          title="Wil jouw club ook op NXTTRACK?"
          body="Stuur deze pagina naar het bestuur of nodig hen uit voor een kennismakingsgesprek. Wij doen de rest."
          primaryLabel="Plan kennismakingsgesprek"
          primaryHref="/contact"
          secondaryHref="/features"
          secondaryLabel="Bekijk de features"
        />
      </Section>
    </>
  );
}
