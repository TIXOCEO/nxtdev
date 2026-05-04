import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Calendar,
  Sparkles,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, EyebrowHeading } from "@/components/marketing/section";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { IconFramePlaceholder } from "@/components/marketing/icon-frame";
import { FeatureCard } from "@/components/marketing/feature-card";
import { CtaBlock } from "@/components/marketing/cta-block";
import {
  FEATURES,
  HOW_IT_WORKS,
  SECTORS,
  SITE,
  STATS,
  TRUST_POINTS,
} from "@/lib/marketing/site-data";

export const metadata = {
  title: `${SITE.tagline}`,
  description: SITE.description,
};

export default function HomePage() {
  const HeroIcon = FEATURES[0].icon;
  const BadgeIcon = FEATURES[1].icon;
  const ClubfeedIcon = FEATURES[2].icon;
  return (
    <>
      {/* HERO */}
      <Section size="lg" className="relative overflow-hidden" containerClassName="relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 size-[1200px] rounded-full bg-gradient-radial from-[#eaf5b8]/60 via-transparent to-transparent blur-3xl" />
          <div className="absolute -top-40 right-0 size-[500px] rounded-full bg-[#f7fbe9] blur-3xl opacity-70" />
          <div className="absolute -bottom-20 left-0 size-[400px] rounded-full bg-[#eef6cf]/60 blur-3xl" />
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <ScrollReveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] backdrop-blur">
                <Sparkles className="size-3.5 text-[#3f5a08]" />
                Nieuw — clubplatform van de volgende generatie
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.05}>
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold tracking-tight text-[var(--text-primary)] [text-wrap:balance]">
                Elke sporter.{" "}
                <span className="bg-gradient-to-br from-[#5a7d10] to-[#3f5a08] bg-clip-text text-transparent">
                  Elke stap.
                </span>
              </h1>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
                NXTTRACK is het complete clubplatform voor sportverenigingen,
                academies, zwemscholen en sportscholen. Eén systeem voor
                ontwikkeling, organisatie en clubbeleving — dat meegroeit met
                elke sporter én elke vereniging.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.15}>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-[#1c2616] text-white hover:bg-[#0b0f0a] h-12 px-6 text-[15px] font-semibold shadow-lg"
                >
                  <Link href="/contact">
                    <Calendar className="size-4" />
                    Plan kennismakingsgesprek
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-full h-12 px-6 text-[15px] font-medium border-[var(--surface-border)]"
                >
                  <Link href="/features">
                    Bekijk de features
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                {[
                  "Eén platform i.p.v. losse apps",
                  "Speciaal voor sport en educatie",
                  "AVG-conform en veilig voor jeugd",
                  "Live binnen één werkweek",
                ].map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
                  >
                    <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-[#3f5a08]" />
                    {p}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.1} variant="up">
            <div className="relative">
              <IconFramePlaceholder
                icon={HeroIcon}
                label="Leerlingvolgsysteem"
                ratio="tall"
                tone="lime"
              />
              <div className="absolute -bottom-8 -left-8 hidden md:block w-56 rounded-3xl border border-[var(--surface-border)] bg-white p-5 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[#3f5a08]">
                    <BadgeIcon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Badge behaald
                    </div>
                    <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      Eerste 10 trainingen
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-[var(--surface-soft)] overflow-hidden">
                  <div className="h-full w-3/4 rounded-full bg-[var(--accent)]" />
                </div>
              </div>
              <div className="absolute -top-6 -right-4 hidden md:block w-48 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-xl">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Voortgang module
                </div>
                <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                  Diploma B
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <span className="text-[#3f5a08] font-semibold">8 van 12</span>
                  onderdelen behaald
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </Section>

      {/* TRUST STRIP */}
      <Section tone="soft" size="sm">
        <ScrollReveal>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center sm:text-left">
                <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
                  {s.value}
                </div>
                <div className="mt-1 text-xs sm:text-sm uppercase tracking-wider text-[var(--text-secondary)] font-medium">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </Section>

      {/* FEATURES OVERVIEW */}
      <Section size="lg">
        <ScrollReveal>
          <EyebrowHeading
            eyebrow="Alles in één platform"
            title={
              <>
                Zes kernmodules.{" "}
                <span className="text-[var(--text-secondary)]">
                  Eén verhaal van groei.
                </span>
              </>
            }
            body="Geen losse apps, geen verspreide data. NXTTRACK brengt alles wat een vereniging nodig heeft samen in één heldere ervaring."
          />
        </ScrollReveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, idx) => (
            <ScrollReveal key={f.slug} delay={idx * 0.06}>
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

      {/* WHY NXTTRACK */}
      <Section tone="soft" size="lg">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <ScrollReveal>
            <IconFramePlaceholder
              icon={ClubfeedIcon}
              label="Clubfeed"
              ratio="square"
              tone="ivory"
            />
          </ScrollReveal>
          <ScrollReveal delay={0.05}>
            <EyebrowHeading
              eyebrow="Waarom NXTTRACK"
              title="Een platform dat sporters, trainers én bestuur ontzorgt."
              body="NXTTRACK zet de sporter centraal — zonder bestuurders en trainers te vergeten. Eén systeem voor ontwikkeling, organisatie en clubbeleving zorgt voor rust, overzicht en motivatie."
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

      {/* SECTORS */}
      <Section size="lg">
        <ScrollReveal>
          <EyebrowHeading
            eyebrow="Voor wie"
            title="Gebouwd voor élke vorm van sport en educatie."
            body="Van zwemscholen tot academies, van sportverenigingen tot dansstudio's: NXTTRACK past zich aan jouw discipline aan."
          />
        </ScrollReveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SECTORS.map((s, idx) => (
            <ScrollReveal key={s.slug} delay={idx * 0.05}>
              <Link
                href={s.href}
                className="group relative h-full rounded-3xl bg-white border border-[var(--surface-border)] p-7 transition-all duration-300 hover:border-[var(--accent)] hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)] block overflow-hidden"
              >
                <div className="absolute -top-12 -right-12 size-40 rounded-full bg-[var(--accent)]/0 group-hover:bg-[var(--accent)]/10 blur-3xl transition-all" />
                <div className="relative">
                  <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--text-primary)] group-hover:bg-[var(--accent)]/15 group-hover:text-[#3f5a08] transition-colors">
                    <s.icon className="size-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {s.short}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[#3f5a08] group-hover:gap-2 transition-all">
                    Bekijk meer
                    <ArrowRight className="size-4" />
                  </span>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section tone="accent" size="lg">
        <ScrollReveal>
          <EyebrowHeading
            eyebrow="Zo werken we samen"
            title="Van eerste gesprek tot complete club, in vier stappen."
            body="We werken in korte lijnen en met persoonlijke begeleiding. Niet voor één seizoen — maar voor de lange termijn."
            align="center"
          />
        </ScrollReveal>

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((step, idx) => (
            <ScrollReveal key={step.step} delay={idx * 0.07}>
              <div className="relative h-full rounded-3xl bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.3)]">
                <div className="text-xs font-mono font-semibold text-[#3f5a08]">
                  {step.step}
                </div>
                <div className="mt-3 inline-flex size-11 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[#3f5a08]">
                  <step.icon className="size-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[var(--text-primary)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {step.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Section>

      {/* TWO AUDIENCES */}
      <Section size="lg">
        <div className="grid gap-6 lg:grid-cols-2">
          <ScrollReveal>
            <Link
              href="/voor-wie"
              className="group block h-full rounded-[32px] overflow-hidden border border-[var(--surface-border)] bg-white p-8 sm:p-10 transition-all hover:border-[#3f5a08] hover:shadow-[0_30px_80px_-40px_rgba(15,23,42,0.4)]"
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-[#3f5a08]">
                Voor verenigingen
              </div>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                Professionaliteit, schaalbaarheid en grip — zonder gedoe.
              </h3>
              <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)]">
                Vervang spreadsheets, losse apps en versnipperde communicatie
                door één systeem dat trainers, coördinatoren en bestuur
                vooruithelpt. Eén waarheid voor de hele club.
              </p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[#3f5a08] group-hover:gap-2 transition-all">
                Lees meer voor verenigingen
                <ArrowRight className="size-4" />
              </span>
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={0.05}>
            <Link
              href="/voor-sporters"
              className="group block h-full rounded-[32px] overflow-hidden border border-transparent bg-gradient-to-br from-[#0b0f0a] to-[#1c2616] p-8 sm:p-10 text-white transition-all hover:border-[var(--accent)] hover:shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)]"
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
                Voor sporters & ouders
              </div>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight">
                Plezier, motivatie en erkenning bij elke stap die je zet.
              </h3>
              <p className="mt-4 text-base leading-relaxed text-white/75">
                Geen prestatiedruk, geen onderlinge vergelijking. Wel duidelijke
                voortgang, mooie momenten in de feed en badges voor inzet.
              </p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] group-hover:gap-2 transition-all">
                Lees meer voor sporters
                <ArrowRight className="size-4" />
              </span>
            </Link>
          </ScrollReveal>
        </div>
      </Section>

      {/* QUOTE */}
      <Section tone="soft" size="md">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl text-center">
            <Quote className="mx-auto size-10 text-[var(--accent)]" />
            <blockquote className="mt-6 text-2xl sm:text-3xl font-medium leading-snug tracking-tight text-[var(--text-primary)] [text-wrap:balance]">
              “NXTTRACK is geen tool. Het is een platform dat verenigingen helpt
              om elke sporter te begeleiden, elke stap zichtbaar te maken en
              samen te bouwen aan een sterke club.”
            </blockquote>
            <div className="mt-6 text-sm font-medium uppercase tracking-widest text-[var(--text-secondary)]">
              {SITE.tagline}
            </div>
          </div>
        </ScrollReveal>
      </Section>

      {/* FINAL CTA */}
      <Section size="md">
        <ScrollReveal>
          <CtaBlock
            title="Klaar om jullie club naar het volgende niveau te brengen?"
            body="Plan een vrijblijvend kennismakingsgesprek van 30 minuten. We laten zien hoe NXTTRACK eruit ziet voor jouw sport en jouw club."
          />
        </ScrollReveal>
      </Section>
    </>
  );
}
