import { Sparkles } from "lucide-react";
import { Section, EyebrowHeading } from "@/components/marketing/section";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { CtaBlock } from "@/components/marketing/cta-block";
import { ROADMAP, type RoadmapItem } from "@/lib/marketing/site-data";

export const metadata = {
  title: "Roadmap",
  description:
    "Bekijk waar het NXTTRACK-team aan werkt en wat er binnenkort live gaat. Wensen vanuit verenigingen bepalen mede de agenda.",
};

const STATUS_LABEL: Record<RoadmapItem["status"], string> = {
  "in-ontwikkeling": "In ontwikkeling",
  binnenkort: "Binnenkort live",
  gepland: "Gepland",
  ideeën: "Ideeën & verkenningen",
};

const STATUS_COLOR: Record<RoadmapItem["status"], string> = {
  "in-ontwikkeling": "bg-[var(--accent)] text-[#1c2616]",
  binnenkort: "bg-[#1c2616] text-white",
  gepland:
    "bg-white text-[var(--text-primary)] border border-[var(--surface-border)]",
  ideeën: "bg-[var(--surface-soft)] text-[var(--text-secondary)]",
};

export default function RoadmapPage() {
  const groups = (
    ["in-ontwikkeling", "binnenkort", "gepland", "ideeën"] as const
  )
    .map((status) => ({
      status,
      items: ROADMAP.filter((r) => r.status === status),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <Section size="md">
        <ScrollReveal>
          <EyebrowHeading
            as="h1"
            eyebrow="Ontwikkelagenda"
            title="Transparant over wat er komt."
            body="NXTTRACK groeit met de verenigingen die het gebruiken. Zodra er nieuwe items op de agenda staan, lees je het hier als eerste."
            align="center"
          />
        </ScrollReveal>
      </Section>

      <Section size="md" className="!pt-0">
        {groups.length === 0 ? (
          <ScrollReveal>
            <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-10 text-center">
              <div className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent)]/20 text-[#3f5a08]">
                <Sparkles className="size-6" strokeWidth={1.75} />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">
                De volgende update wordt binnenkort gedeeld.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                We werken op dit moment aan verbeteringen achter de schermen.
                Heb je een wens of idee voor NXTTRACK? Klanten krijgen voorrang
                op feature-stemmen — laat het ons weten.
              </p>
            </div>
          </ScrollReveal>
        ) : (
          <div className="space-y-12">
            {groups.map((group) => (
              <ScrollReveal key={group.status}>
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[group.status]}`}
                    >
                      {STATUS_LABEL[group.status]}
                    </span>
                    <span className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-3xl border border-[var(--surface-border)] bg-white p-6"
                      >
                        <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[#3f5a08]">
                          <item.icon className="size-5" strokeWidth={1.75} />
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                          {item.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        )}
      </Section>

      <Section size="md">
        <CtaBlock
          eyebrow="Heb je een idee?"
          title="Stuurt jullie wens onze roadmap?"
          body="We bouwen NXTTRACK samen met de verenigingen die het gebruiken. Klanten krijgen voorrang op feature-stemmen — laat van je horen."
          primaryLabel="Stuur jullie wens"
          primaryHref="/contact"
          secondaryHref="/features"
          secondaryLabel="Bekijk huidige features"
        />
      </Section>
    </>
  );
}
