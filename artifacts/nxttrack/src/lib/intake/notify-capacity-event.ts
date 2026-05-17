import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications/send-notification";

/**
 * Sprint 76b — Stuur een in-app notificatie naar tenant-admins
 * wanneer er vandaag een open capacity_available_event bestaat voor
 * deze groep. Idempotent via de notification dedup-key
 * `capacity_available_candidates` (source_ref = event.id).
 *
 * Wordt aangeroepen na admin-acties die capaciteit vrijmaken
 * (`removeMemberFromGroup`, `updateGroup` met capaciteit↑). De
 * DB-trigger heeft het event-rij dan al ingeschreven; wij zoeken het
 * event vervolgens op en sturen de notificatie. Best-effort —
 * fouten worden gelogd maar nooit ge-rethrowed (admin-actie moet
 * blijven slagen).
 */
export async function notifyCapacityEventIfAny(
  tenantId: string,
  groupId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();

    // Zoek het meest recente open event voor deze groep (vandaag).
    // De DB-trigger heeft 'm net aangemaakt via day-dedup.
    const { data: ev } = await admin
      .from("capacity_available_events")
      .select("id, freed_seats, candidate_count, trigger_source")
      .eq("tenant_id", tenantId)
      .eq("group_id", groupId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ev) return;

    // Sprint 76g (task #130): tenant-drempel via settings_json. Wanneer
    // er minder plekken zijn vrijgekomen dan de drempel slaan we de
    // notify over (het event-rij blijft staan zodat de UI-tile telt).
    const { data: tenantRow } = await admin
      .from("tenants")
      .select("settings_json")
      .eq("id", tenantId)
      .maybeSingle();
    const settings =
      ((tenantRow?.settings_json ?? {}) as Record<string, unknown>) ?? {};
    const rawThreshold = settings["capacity_event_min_freed_seats"];
    const parsedThreshold =
      typeof rawThreshold === "number"
        ? rawThreshold
        : typeof rawThreshold === "string"
          ? Number.parseInt(rawThreshold, 10)
          : NaN;
    const threshold =
      Number.isFinite(parsedThreshold) && parsedThreshold > 0
        ? parsedThreshold
        : 1;
    const freed = (ev.freed_seats as number) ?? 1;
    if (freed < threshold) return;

    const { data: g } = await admin
      .from("groups")
      .select("name")
      .eq("tenant_id", tenantId)
      .eq("id", groupId)
      .maybeSingle();
    const groupName = (g?.name as string | undefined) ?? "een groep";

    const seats = (ev.freed_seats as number) ?? 1;
    const cand = (ev.candidate_count as number) ?? 0;

    // Sprint 76d — vast notificatie-format conform spec:
    // "Plek vrijgekomen in groep <X> — <N> kandidaten".
    const title = `Plek vrijgekomen in groep ${groupName} — ${cand} ${
      cand === 1 ? "kandidaat" : "kandidaten"
    }`;
    const contentText =
      `Er ${seats === 1 ? "is 1 plek" : `zijn ${seats} plekken`} vrijgekomen in ${groupName}. ` +
      `${cand} wachtende ${cand === 1 ? "kandidaat" : "kandidaten"} gevonden. ` +
      `Open de placement-assistent om af te handelen.`;

    // Deeplink direct naar de capacity-flow gefilterd op deze groep,
    // anchored op het event-blok zodat admins meteen de juiste card zien.
    const pushUrl = `/tenant/intake/vrijgekomen-plekken#evt-${ev.id as string}`;

    await sendNotification({
      tenantId,
      title,
      contentText,
      targets: [{ target_type: "role", target_id: "tenant_admin" }],
      source: "capacity_available_candidates",
      sourceRef: ev.id as string,
      pushUrl,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[capacity_event] notify failed:", err);
  }
}
