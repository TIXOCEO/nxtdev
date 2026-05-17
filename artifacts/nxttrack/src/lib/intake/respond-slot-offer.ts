import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send-email";
import { sendNotification } from "@/lib/notifications/send-notification";
import { placeSubmissionCore } from "@/lib/intake/place-submission-core";

/**
 * Sprint 74 — Verwerk een publieke accept/decline-klik op een
 * `intake_slot_offers`-link. Token is het enige autorisatie-bewijs.
 *
 * Idempotentie/replay-veiligheid is gegarandeerd door een atomaire
 * conditional UPDATE: het token wordt alleen "geclaimd" wanneer de
 * rij nog `status='pending'`, `used_at IS NULL` en `expires_at > now()`
 * is. Twee gelijktijdige klikken kunnen dus nooit allebei de
 * post-processing draaien.
 */

const SENTINEL_ACTOR = "00000000-0000-0000-0000-000000000000";

export type SlotResponseStatus =
  | "accepted"
  | "declined"
  | "expired"
  | "already_used"
  | "not_found"
  | "error";

export interface SlotResponseResult {
  status: SlotResponseStatus;
  message: string;
  groupName?: string | null;
  submissionId?: string;
}

export type SlotPeekKind =
  | "pending"
  | "expired"
  | "accepted"
  | "declined"
  | "cancelled"
  | "not_found";

export interface SlotPeekResult {
  kind: SlotPeekKind;
  groupName?: string | null;
  contactName?: string | null;
  expiresAt?: string;
  submissionId?: string;
}

/**
 * Read-only lookup voor de bevestigings-pagina. Doet GEEN mutatie.
 */
export async function peekSlotOffer(token: string): Promise<SlotPeekResult> {
  if (!token || typeof token !== "string") {
    return { kind: "not_found" };
  }
  const admin = createAdminClient();
  const { data: offer, error } = await admin
    .from("intake_slot_offers")
    .select(
      "id, tenant_id, submission_id, group_id, status, expires_at, used_at",
    )
    .eq("token", token)
    .maybeSingle();
  if (error || !offer) return { kind: "not_found" };

  const expired =
    offer.status === "pending" && new Date(offer.expires_at).getTime() < Date.now();

  const [{ data: grp }, { data: sub }] = await Promise.all([
    admin
      .from("groups")
      .select("name")
      .eq("id", offer.group_id)
      .eq("tenant_id", offer.tenant_id)
      .maybeSingle(),
    admin
      .from("intake_submissions")
      .select("contact_name")
      .eq("id", offer.submission_id)
      .eq("tenant_id", offer.tenant_id)
      .maybeSingle(),
  ]);

  let kind: SlotPeekKind;
  if (expired) kind = "expired";
  else if (offer.status === "pending") kind = "pending";
  else if (offer.status === "accepted") kind = "accepted";
  else if (offer.status === "declined") kind = "declined";
  else if (offer.status === "cancelled" || offer.status === "expired")
    kind = "cancelled";
  else kind = "not_found";

  return {
    kind,
    groupName: (grp?.name as string | undefined) ?? null,
    contactName: (sub?.contact_name as string | undefined) ?? null,
    expiresAt: offer.expires_at as string,
    submissionId: offer.submission_id as string,
  };
}

export async function respondToSlotOffer(args: {
  token: string;
  decision: "accept" | "decline";
}): Promise<SlotResponseResult> {
  if (!args?.token || typeof args.token !== "string") {
    return { status: "not_found", message: "Onbekende of verlopen link." };
  }
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const newStatus = args.decision === "accept" ? "accepted" : "declined";

  // Atomaire claim: enkel pending + niet-gebruikt + niet-verlopen.
  const { data: claimed, error: claimErr } = await admin
    .from("intake_slot_offers")
    .update({ status: newStatus, used_at: nowIso })
    .eq("token", args.token)
    .eq("status", "pending")
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .select(
      "id, tenant_id, submission_id, group_id, suggestion_rank, suggestion_score",
    )
    .maybeSingle();
  if (claimErr) {
    return { status: "error", message: "Er ging iets mis. Probeer het later opnieuw." };
  }

  if (!claimed) {
    // Claim faalde — bepaal waarom via een peek.
    const peek = await peekSlotOffer(args.token);
    if (peek.kind === "not_found") {
      return { status: "not_found", message: "Onbekende of verlopen link." };
    }
    if (peek.kind === "expired") {
      // Best-effort markeer als verlopen voor admin-overzicht.
      await admin
        .from("intake_slot_offers")
        .update({ status: "expired", used_at: nowIso })
        .eq("token", args.token)
        .eq("status", "pending");
      return {
        status: "expired",
        message: "Deze link is verlopen. Neem contact op met de organisatie.",
        submissionId: peek.submissionId,
      };
    }
    // accepted / declined / cancelled
    const msg =
      peek.kind === "accepted"
        ? "Deze plek is al geaccepteerd."
        : peek.kind === "declined"
          ? "Deze plek is al geweigerd."
          : "Deze link is niet meer geldig.";
    return {
      status: "already_used",
      message: msg,
      submissionId: peek.submissionId,
      groupName: peek.groupName ?? null,
    };
  }

  // Vanaf hier: de rij is exclusief van ons. Haal groep + contact op
  // voor mail/notificatie.
  const [{ data: grp }, { data: sub }] = await Promise.all([
    admin
      .from("groups")
      .select("name")
      .eq("id", claimed.group_id)
      .eq("tenant_id", claimed.tenant_id)
      .maybeSingle(),
    admin
      .from("intake_submissions")
      .select("contact_name, contact_email")
      .eq("id", claimed.submission_id)
      .eq("tenant_id", claimed.tenant_id)
      .maybeSingle(),
  ]);
  const groupName = (grp?.name as string | undefined) ?? null;

  if (args.decision === "accept") {
    const place = await placeSubmissionCore({
      submissionId: claimed.submission_id,
      groupId: claimed.group_id,
      tenantId: claimed.tenant_id,
      actorUserId: SENTINEL_ACTOR,
      suggestionRank: claimed.suggestion_rank ?? undefined,
      suggestionScore: claimed.suggestion_score ?? undefined,
      viaSlotOffer: true,
      slotOfferId: claimed.id,
    });
    if (!place.ok) {
      // Place faalde (bv. submission al placed in andere groep) — revert
      // claim naar pending zodat admin handmatig kan ingrijpen.
      await admin
        .from("intake_slot_offers")
        .update({ status: "pending", used_at: null })
        .eq("id", claimed.id)
        .eq("tenant_id", claimed.tenant_id);
      return {
        status: "error",
        message:
          "Kon de plek niet bevestigen. Neem contact op met de organisatie.",
        submissionId: claimed.submission_id,
      };
    }

    await recordAudit({
      tenant_id: claimed.tenant_id,
      actor_user_id: SENTINEL_ACTOR,
      action: "intake.slot_offer.accepted",
      meta: {
        submission_id: claimed.submission_id,
        offer_id: claimed.id,
        group_id: claimed.group_id,
        group_name: groupName,
      },
    });

    if (sub?.contact_email) {
      void sendEmail({
        tenantId: claimed.tenant_id,
        templateKey: "intake_slot_confirmation",
        to: sub.contact_email,
        triggerSource: "intake.slot_offer.accepted",
        variables: {
          contact_name: sub.contact_name ?? "",
          group_name: groupName ?? "",
        },
      }).catch((e: unknown) => {
        // eslint-disable-next-line no-console
        console.error("[slot-offer] confirm email failed:", e);
      });
    }

    void sendNotification({
      tenantId: claimed.tenant_id,
      title: "Plek geaccepteerd",
      contentText: `${sub?.contact_name ?? "Een aanvrager"} accepteerde plek in ${groupName ?? "een groep"}.`,
      targets: [{ target_type: "role", target_id: "tenant_admin" }],
      sendEmail: false,
      sendPush: false,
      source: "intake_slot_accepted",
      sourceRef: claimed.id,
      createdBy: null,
    }).catch((e: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[slot-offer] notify accepted failed:", e);
    });

    return {
      status: "accepted",
      message: "Je plek is bevestigd.",
      groupName,
      submissionId: claimed.submission_id,
    };
  }

  // Decline-pad — submission terug naar 'waitlisted' wanneer reopenable.
  const { data: curSub } = await admin
    .from("intake_submissions")
    .select("status")
    .eq("id", claimed.submission_id)
    .eq("tenant_id", claimed.tenant_id)
    .maybeSingle();
  const curStatus = (curSub?.status as string | undefined) ?? "";
  const reopenable = ["submitted", "in_review", "needs_review", "waitlisted"];
  if (reopenable.includes(curStatus) && curStatus !== "waitlisted") {
    await admin
      .from("intake_submissions")
      .update({ status: "waitlisted" })
      .eq("id", claimed.submission_id)
      .eq("tenant_id", claimed.tenant_id);
  }

  await recordAudit({
    tenant_id: claimed.tenant_id,
    actor_user_id: SENTINEL_ACTOR,
    action: "intake.slot_offer.declined",
    meta: {
      submission_id: claimed.submission_id,
      offer_id: claimed.id,
      group_id: claimed.group_id,
      group_name: groupName,
    },
  });

  void sendNotification({
    tenantId: claimed.tenant_id,
    title: "Plek geweigerd",
    contentText: `${sub?.contact_name ?? "Een aanvrager"} weigerde plek in ${groupName ?? "een groep"}.`,
    targets: [{ target_type: "role", target_id: "tenant_admin" }],
    sendEmail: false,
    sendPush: false,
    source: "intake_slot_declined",
    sourceRef: claimed.id,
    createdBy: null,
  }).catch((e: unknown) => {
    // eslint-disable-next-line no-console
    console.error("[slot-offer] notify declined failed:", e);
  });

  return {
    status: "declined",
    message: "Bedankt voor je reactie. Je plek is teruggegeven.",
    groupName,
    submissionId: claimed.submission_id,
  };
}
