"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";

/**
 * Sprint 76 — Server actions voor capacity-available events.
 *
 * Admins kunnen een event markeren als afgehandeld (er is een
 * concrete kandidaat geplaatst of een slot-offer verstuurd) of
 * wegklikken wanneer het niet meer relevant is (bv. capaciteit
 * werd alweer ingenomen door een directe inschrijving).
 */

const idInput = z.object({
  eventId: z.string().uuid(),
});

export interface CapacityEventResult {
  ok: boolean;
  error?: string;
}

async function updateEventStatus(
  eventId: string,
  toStatus: "handled" | "dismissed",
): Promise<CapacityEventResult> {
  const admin = createAdminClient();
  const { data: ev, error } = await admin
    .from("capacity_available_events")
    .select("id, tenant_id, status, group_id")
    .eq("id", eventId)
    .maybeSingle();
  if (error || !ev) return { ok: false, error: "event niet gevonden" };
  if (ev.status !== "open") {
    return { ok: false, error: `event is al ${ev.status}` };
  }

  const user = await assertTenantAccess(ev.tenant_id);

  // Atomic claim: alleen wanneer status nog open is. Voorkomt dat twee
  // admins gelijktijdig handled+dismissed schrijven (race-condition fix
  // uit code-review). PostgREST returnt de gewijzigde rijen via select().
  const { data: claimed, error: updErr } = await admin
    .from("capacity_available_events")
    .update({
      status: toStatus,
      handled_at: new Date().toISOString(),
      handled_by: user.id,
    })
    .eq("id", eventId)
    .eq("tenant_id", ev.tenant_id)
    .eq("status", "open")
    .select("id");
  if (updErr) return { ok: false, error: updErr.message };
  if (!claimed || claimed.length === 0) {
    return { ok: false, error: "event is al afgehandeld door iemand anders" };
  }

  await recordAudit({
    tenant_id: ev.tenant_id,
    actor_user_id: user.id,
    action:
      toStatus === "handled"
        ? "intake.capacity_event.handled"
        : "intake.capacity_event.dismissed",
    meta: { event_id: eventId, group_id: ev.group_id },
  });

  revalidatePath("/tenant/intake");
  revalidatePath("/tenant/intake/vrijgekomen-plekken");
  return { ok: true };
}

export async function markCapacityEventHandled(
  input: z.infer<typeof idInput>,
): Promise<CapacityEventResult> {
  const parsed = idInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ongeldige invoer" };
  return updateEventStatus(parsed.data.eventId, "handled");
}

export async function dismissCapacityEvent(
  input: z.infer<typeof idInput>,
): Promise<CapacityEventResult> {
  const parsed = idInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ongeldige invoer" };
  return updateEventStatus(parsed.data.eventId, "dismissed");
}
