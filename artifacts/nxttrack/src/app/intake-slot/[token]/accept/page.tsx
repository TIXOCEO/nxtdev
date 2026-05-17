import { peekSlotOffer } from "@/lib/intake/respond-slot-offer";
import { SlotConfirmCard } from "@/components/public/SlotConfirmCard";
import { SlotResponseCard } from "@/components/public/SlotResponseCard";

export const dynamic = "force-dynamic";

/**
 * Sprint 74 — GET toont alleen een bevestigings-pagina met een POST-form.
 * Pas op een POST-klik wordt `respondToSlotOffer` uitgevoerd. Hierdoor
 * triggeren mail-scanners/link-prefetchers nooit per ongeluk een accept.
 */
export default async function IntakeSlotAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const peek = await peekSlotOffer(token);

  if (peek.kind === "pending") {
    return (
      <SlotConfirmCard
        token={token}
        decision="accept"
        groupName={peek.groupName}
        contactName={peek.contactName}
        expiresAt={peek.expiresAt}
      />
    );
  }

  const status =
    peek.kind === "not_found"
      ? "not_found"
      : peek.kind === "expired"
        ? "expired"
        : "already_used";
  const message =
    peek.kind === "accepted"
      ? "Deze plek is al geaccepteerd."
      : peek.kind === "declined"
        ? "Deze plek is al geweigerd."
        : peek.kind === "cancelled"
          ? "Deze aanbieding is ingetrokken."
          : peek.kind === "expired"
            ? "Deze link is verlopen. Neem contact op met de organisatie."
            : "Onbekende of verlopen link.";

  return (
    <SlotResponseCard
      decision="accept"
      result={{
        status,
        message,
        groupName: peek.groupName ?? null,
        submissionId: peek.submissionId,
      }}
    />
  );
}
