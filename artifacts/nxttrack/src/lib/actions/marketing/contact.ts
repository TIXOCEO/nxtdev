"use server";

import { sendRawEmail } from "@/lib/email/send-email";
import { intakeRequestSchema, type IntakeRequestInput } from "@/lib/validation/marketing";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Verwerkt een aanvraag voor een kennismakingsgesprek vanaf de
 * marketingsite. Stuurt een notificatie naar het NXTTRACK-team en een
 * bevestiging naar de aanvrager. We slaan de aanvraag (nog) niet op in
 * de database — een mailtrail is voor v1 voldoende.
 */
export async function submitIntakeRequest(
  input: IntakeRequestInput,
): Promise<ActionResult<{ delivered: boolean }>> {
  const parsed = intakeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Niet alle velden zijn correct ingevuld.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Honeypot: als hier iets in zit is het bijna zeker een bot.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return { ok: true, data: { delivered: false } };
  }

  const teamRecipient =
    process.env.MARKETING_LEAD_RECIPIENT?.trim() ||
    process.env.MAIL_DEFAULT_FROM_EMAIL?.trim() ||
    "hallo@nxttrack.nl";

  const summaryLines = [
    `Naam: ${parsed.data.name}`,
    `E-mail: ${parsed.data.email}`,
    `Organisatie: ${parsed.data.organisation}`,
    parsed.data.role ? `Functie: ${parsed.data.role}` : null,
    `Sector: ${parsed.data.sector}`,
    parsed.data.members ? `Leden: ${parsed.data.members}` : null,
    `Voorkeur contact: ${parsed.data.preferred_contact}`,
    parsed.data.phone ? `Telefoon: ${parsed.data.phone}` : null,
    "",
    "Bericht:",
    parsed.data.message ?? "(geen bericht)",
  ]
    .filter(Boolean)
    .join("\n");

  const teamMail = await sendRawEmail({
    to: teamRecipient,
    subject: `[NXTTRACK lead] ${parsed.data.organisation} — ${parsed.data.name}`,
    text: summaryLines,
    triggerSource: "marketing_intake",
  });

  // Bevestiging naar de aanvrager — best-effort. Als deze faalt is het
  // bericht naar het team belangrijker.
  await sendRawEmail({
    to: parsed.data.email,
    subject: "Bedankt voor je aanvraag — NXTTRACK",
    text: [
      `Hoi ${parsed.data.name.split(" ")[0]},`,
      "",
      "Bedankt dat je contact hebt opgenomen met NXTTRACK!",
      "We nemen binnen één werkdag contact op om een kennismakingsgesprek in te plannen.",
      "",
      "Heb je in de tussentijd vragen? Reageer gerust op deze mail.",
      "",
      "Met sportieve groet,",
      "Het NXTTRACK-team",
    ].join("\n"),
    triggerSource: "marketing_intake_confirm",
  });

  if (!teamMail.ok) {
    return {
      ok: false,
      error:
        "We konden je aanvraag niet versturen. Probeer het later opnieuw of mail rechtstreeks naar hallo@nxttrack.nl.",
    };
  }

  return { ok: true, data: { delivered: true } };
}
