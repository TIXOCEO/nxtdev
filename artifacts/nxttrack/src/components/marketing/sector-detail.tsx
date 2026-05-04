import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, EyebrowHeading } from "@/components/marketing/section";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { IconFramePlaceholder } from "@/components/marketing/icon-frame";
import { CtaBlock } from "@/components/marketing/cta-block";
import { SECTORS, FEATURES, type Sector, type FeatureSlug } from "@/lib/marketing/site-data";

/**
 * Gedeelde template voor sectorpagina's. Each sector kiest welke
 * features extra benadrukt worden.
 */
export function SectorDetailPage({
  sector,
  intro,
  scenario,
  spotlightFeatureSlugs,
}: {
  sector: Sector;
  intro: string;
  scenario: { title: string; body: string }[];
  spotlightFeatureSlugs: FeatureSlug[];
}) {
  const otherSectors = SECTORS.filter((s) => s.slug !== sector.slug).slice(0, 3);
  const Icon = sector.icon;
  const spotlight = FEATURES.filter((f) => spotlightFeatureSlugs.includes(f.slug));

  return (
    <>
      <Section size="md" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 right-0 size-[700px] rounded-full bg-[#f7fbe9]/60 blur-3xl" />
        </div>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              <Icon className="size-3.5 text-[#3f5a08]" />
              Voor wie
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[var(--text-primary)] [text-wrap:balance]">
              NXTTRACK voor {sector.title.toLowerCase()}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
              {intro}
            </p>
            <ul className="mt-7 grid gap-2.5 max-w-xl">
              {sector.highlights.map((h) => (
                <li
                  key={h}
                  className="flex items-start gap-2 text-sm text-[var(--text-primary)]"
                >
                  <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-[#3f5a08]" />
                  <span className="text-[var(--text-secondary)]">{h}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[#1c2616] text-white hover:bg-[#0b0f0a] h-12 px-6 text-[15px] font-semibold"
              >
                <Link href="/contact">Plan kennismakingsgesprek</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full h-12 px-6 text-[15px] font-medium"
              >
                <Link href="/features">
                  Alle features
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.05}>
            <IconFramePlaceholder
              icon={Icon}
              label={sector.title}
              ratio="square"
              tone="lime"
            />
          </ScrollReveal>
        </div>
      </Section>

      <Section tone="soft" size="lg">
        <ScrollReveal>
          <EyebrowHeading
            eyebrow="Voordelen op een rij"
            title={`Wat NXTTRACK voor ${sector.title.toLowerCase()} betekent.`}
          />
        </ScrollReveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {sector.benefits.map((b, idx) => (
            <ScrollReveal key={b.title} delay={idx * 0.05}>
              <div className="rounded-3xl bg-white border border-[var(--surface-border)] p-7 h-full">
                <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[#3f5a08]">
                  <b.icon className="size-6" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[var(--text-primary)]">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {b.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Section>

      <Section size="lg">
        <ScrollReveal>
          <EyebrowHeading
            eyebrow="Hoe het werkt in de praktijk"
            title="Een typische dag, week of seizoen."
          />
        </ScrollReveal>
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {scenario.map((item, idx) => (
            <ScrollReveal key={item.title} delay={idx * 0.05}>
              <div className="rounded-3xl border border-[var(--surface-border)] bg-white p-7">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-[var(--text-secondary)]">
                  {item.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Section>

      {spotlight.length > 0 ? (
        <Section tone="soft" size="md">
          <ScrollReveal>
            <EyebrowHeading
              eyebrow="Modules in de spotlight"
              title="Voor jullie sector extra waardevol."
            />
          </ScrollReveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {spotlight.map((f) => (
              <Link
                key={f.slug}
                href={f.href}
                className="group block rounded-3xl border border-[var(--surface-border)] bg-white p-6 hover:border-[var(--accent)] transition-colors"
              >
                <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--text-primary)] group-hover:bg-[var(--accent)]/15 group-hover:text-[#3f5a08] transition-colors">
                  <f.icon className="size-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">
                  {f.title}
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2">
                  {f.short}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#3f5a08] group-hover:gap-2 transition-all">
                  Bekijk module
                  <ArrowRight className="size-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <Section size="md">
        <ScrollReveal>
          <EyebrowHeading
            eyebrow="Andere sectoren"
            title="Ook geschikt voor:"
          />
        </ScrollReveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {otherSectors.map((o) => (
            <Link
              key={o.slug}
              href={o.href}
              className="group block rounded-3xl border border-[var(--surface-border)] bg-white p-6 hover:border-[var(--accent)] transition-colors"
            >
              <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--text-primary)] group-hover:bg-[var(--accent)]/15 group-hover:text-[#3f5a08] transition-colors">
                <o.icon className="size-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">
                {o.title}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2">
                {o.short}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      <Section size="md">
        <CtaBlock
          title={`Klaar om jullie ${sector.title.toLowerCase()} naar een hoger niveau te brengen?`}
          body="In een vrijblijvend kennismakingsgesprek vertalen we onze modules naar jullie discipline."
        />
      </Section>
    </>
  );
}
