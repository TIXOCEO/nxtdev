"use server";

import {
  respondToSlotOffer,
  type SlotResponseResult,
} from "@/lib/intake/respond-slot-offer";

/**
 * Sprint 74 — Publieke server-action voor de bevestigings-knop op
 * /intake-slot/[token]/accept|decline. Wordt aangeroepen vanuit een
 * <form action={...}> via `useActionState`. POST-only — een GET op de
 * page-route doet geen mutatie, dus mail-scanners en link-prefetchers
 * triggeren nooit per ongeluk accept/decline.
 */
export async function submitSlotResponse(
  _prev: SlotResponseResult | null,
  formData: FormData,
): Promise<SlotResponseResult> {
  const token = String(formData.get("token") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "accept" && decision !== "decline") {
    return { status: "error", message: "Ongeldige actie." };
  }
  return respondToSlotOffer({ token, decision });
}
