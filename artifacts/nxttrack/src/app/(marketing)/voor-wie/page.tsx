import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section, EyebrowHeading } from "@/components/marketing/section";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { CtaBlock } from "@/components/marketing/cta-block";
import { SECTORS } from "@/lib/marketing/site-data";

export const metadata = {
  title: "Voor wie",
  description:
    "NXTTRACK is gebouwd voor sportverenigingen, zwemscholen, sportscholen, academies en dans- of vechtsportscholen. Bekijk wat het platform voor jullie discipline doet.",
};

export default function VoorWiePage() {
  return (
    <>
      <Section size="md">
        <ScrollReveal>
          <EyebrowHeading
            as="h1"
            eyebrow="Voor wie"
            title="Eén platform voor élke vorm van sport en educatie."
            body="Of je nu wedstrijdsporters traint, leerlingen begeleidt naar hun zwemdiploma, fitnessleden ondersteunt of talenten doorontwikkelt — NXTTRACK past zich aan jouw sport aan, niet andersom."
            align="center"
          />
        </ScrollReveal>
      </Section>

      <Section size="md" className="!pt-0">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SECTORS.map((s, idx) => (
            <ScrollReveal key={s.slug} delay={idx * 0.05}>
              <Link
                href={s.href}
                className="group block h-full rounded-3xl bg-white border border-[var(--surface-border)] p-7 transition-all hover:border-[var(--accent)] hover:shadow-[0_30px_70px_-40px_rgba(15,23,42,0.4)]"
              >
                <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--text-primary)] group-hover:bg-[var(--accent)]/15 group-hover:text-[#3f5a08] transition-colors">
                  <s.icon className="size-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {s.short}
                </p>
                <ul className="mt-5 space-y-2">
                  {s.highlights.slice(0, 3).map((h) => (
                    <li
                      key={h}
                      className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      {h}
                    </li>
                  ))}
                </ul>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[#3f5a08] group-hover:gap-2 transition-all">
                  Bekijk meer
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            </ScrollReveal>
          ))}
          <ScrollReveal delay={SECTORS.length * 0.05}>
            <Link
              href="/voor-sporters"
              className="group block h-full rounded-3xl bg-gradient-to-br from-[#0b0f0a] to-[#1c2616] text-white p-7 transition-all hover:shadow-[0_30px_70px_-40px_rgba(15,23,42,0.5)]"
            >
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <span className="text-lg font-semibold">★</span>
              </div>
              <h3 className="mt-5 text-xl font-semibold">Voor sporters & ouders</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                Hoe NXTTRACK eruit ziet vanuit het perspectief van sporters en
                ouders. Plezier, voortgang en erkenning — zonder druk.
              </p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] group-hover:gap-2 transition-all">
                Lees verder
                <ArrowRight className="size-4" />
              </span>
            </Link>
          </ScrollReveal>
        </div>
      </Section>

      <Section size="md">
        <CtaBlock
          title="Welk pakket past bij jullie sport?"
          body="In een kennismakingsgesprek vertalen we onze modules naar jullie discipline."
        />
      </Section>
    </>
  );
}
