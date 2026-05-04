import { Mail, Calendar, MessageSquare, Clock, ShieldCheck } from "lucide-react";
import { Section, EyebrowHeading } from "@/components/marketing/section";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { ContactForm } from "@/components/marketing/contact-form";
import { SITE } from "@/lib/marketing/site-data";

export const metadata = {
  title: "Plan een kennismakingsgesprek",
  description:
    "Vraag een vrijblijvend kennismakingsgesprek aan met het NXTTRACK-team. We laten in 30 minuten zien hoe het platform werkt voor jouw sport en jouw club.",
};

const HIGHLIGHTS = [
  {
    icon: Clock,
    title: "30 minuten",
    body: "Een kort, vrijblijvend gesprek waarin we laten zien wat past bij jullie sport en organisatie.",
  },
  {
    icon: Calendar,
    title: "Live demo",
    body: "We laten NXTTRACK zien aan de hand van jouw situatie — geen voorgekookte presentatie.",
  },
  {
    icon: MessageSquare,
    title: "Persoonlijk advies",
    body: "Welke modules zijn voor jullie het meest waardevol? Wat kan later? We geven eerlijk antwoord.",
  },
  {
    icon: ShieldCheck,
    title: "Geen verplichtingen",
    body: "Wil je verder? Mooi. Niet? Ook prima. We verkopen niets dat niet past.",
  },
];

export default function ContactPage() {
  return (
    <>
      <Section size="md" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[900px] rounded-full bg-gradient-radial from-[#eaf5b8]/50 via-transparent to-transparent blur-3xl" />
        </div>
        <ScrollReveal>
          <EyebrowHeading
            as="h1"
            eyebrow="Kennismaking"
            title="Plan een gesprek met het NXTTRACK-team."
            body="Vertel ons kort over jullie organisatie en we plannen binnen één werkdag een vrijblijvend gesprek van 30 minuten. We luisteren eerst — en laten daarna zien wat past."
            align="center"
          />
        </ScrollReveal>
      </Section>

      <Section size="md" className="!pt-0">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <ScrollReveal>
            <div className="space-y-6">
              {HIGHLIGHTS.map((h) => (
                <div key={h.title} className="flex gap-4 rounded-2xl bg-white p-5 border border-[var(--surface-border)]">
                  <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[#3f5a08]">
                    <h.icon className="size-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {h.title}
                    </div>
                    <div className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {h.body}
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <Mail className="size-4 text-[#3f5a08]" />
                  Liever direct mailen?
                </div>
                <a
                  href={`mailto:${SITE.email}`}
                  className="mt-2 inline-block text-sm text-[#3f5a08] hover:underline"
                >
                  {SITE.email}
                </a>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <ContactForm />
          </ScrollReveal>
        </div>
      </Section>
    </>
  );
}
