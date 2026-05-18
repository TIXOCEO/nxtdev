import Link from "next/link";

interface ExpiredReviewLinkNoticeProps {
  tenantSlug: string;
  contactEmail?: string | null;
}

export function ExpiredReviewLinkNotice({
  tenantSlug,
  contactEmail,
}: ExpiredReviewLinkNoticeProps) {
  const subject = encodeURIComponent("Vraag over mijn inschrijving");
  const body = encodeURIComponent(
    "Hallo,\n\nMijn link naar de voorstellen-pagina is verlopen. Kunnen jullie helpen?\n\nDank!",
  );

  // Task #148 acceptatie-criterium: de "Neem contact op"-knop moet
  // ALTIJD een werkende bestemming hebben. Bij voorkeur een mailto naar
  // de tenant (reply_to_email of contacts.contact_email), anders een
  // fallback naar de tenant-homepage waar contactgegevens in de footer
  // staan. Geen unconditionally-hidden knop meer.
  const contactHref = contactEmail
    ? `mailto:${contactEmail}?subject=${subject}&body=${body}`
    : `/t/${tenantSlug}`;
  const contactLabel = contactEmail
    ? "Neem contact op"
    : "Neem contact op via de homepage";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <h1
          className="text-lg font-semibold sm:text-xl"
          style={{ color: "var(--text-primary)" }}
        >
          Deze link is verlopen
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          De voorstellen-link is 7 dagen geldig of vervalt zodra je een keuze
          hebt gemaakt. Deze link werkt niet meer — je aanvraag staat nog
          steeds bij de organisatie geregistreerd. Neem contact op zodat zij
          je verder kunnen helpen of een nieuwe link kunnen versturen.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <a
            href={contactHref}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-on-primary)",
            }}
          >
            {contactLabel}
          </a>
          <Link
            href={`/t/${tenantSlug}`}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--surface-muted)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            Naar de homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
