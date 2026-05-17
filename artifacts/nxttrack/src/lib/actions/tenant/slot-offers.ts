"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send-email";
import { sendNotification } from "@/lib/notifications/send-notification";
import { appBaseUrl } from "@/lib/url";

/**
 * Sprint 74 — Admin-actie: bied een plek aan een intake-aanvrager aan
 * via een tijdelijk token. Genereert een `intake_slot_offers`-rij,
 * stuurt de aanvrager een e-mail met accept/decline-links en logt het
 * event. De plaatsing zelf gebeurt pas bij accept.
 */

const offerSchema = z.object({
  submissionId: z.string().uuid(),
  groupId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  suggestionRank: z.number().int().min(1).max(50).optional(),
  suggestionScore: z.number().min(0).max(100).optional(),
});

export type OfferIntakeSlotInput = z.infer<typeof offerSchema>;

export interface OfferIntakeSlotResult {
  ok: boolean;
  error?: string;
  offerId?: string;
}

const DEFAULT_TTL_HOURS = 72;

function readTtlHours(settings: unknown): number {
  if (settings && typeof settings === "object") {
    const v = (settings as Record<string, unknown>)["intake_slot_offer_ttl_hours"];
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 24 * 30) {
      return Math.floor(v);
    }
  }
  return DEFAULT_TTL_HOURS;
}

function formatExpiresLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export async function offerIntakeSlot(
  input: OfferIntakeSlotInput,
): Promise<OfferIntakeSlotResult> {
  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ongeldige invoer" };
  const { submissionId, groupId, sessionId, suggestionRank, suggestionScore } =
    parsed.data;

  const admin = createAdminClient();

  const { data: sub, error: subErr } = await admin
    .from("intake_submissions")
    .select(
      "id, tenant_id, status, contact_name, contact_email, form_id",
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (subErr || !sub) return { ok: false, error: "submission niet gevonden" };

  const user = await assertTenantAccess(sub.tenant_id);

  // Aanbieden mag alleen op niet-terminale statussen — placed/rejected/
  // converted blokkeren. waitlisted/needs_review/in_review/submitted OK.
  const allowedFrom = [
    "submitted",
    "in_review",
    "needs_review",
    "waitlisted",
  ];
  if (!allowedFrom.includes(sub.status)) {
    return {
      ok: false,
      error: `plek aanbieden niet toegestaan vanuit status ${sub.status}`,
    };
  }

  if (!sub.contact_email) {
    return { ok: false, error: "geen contact-e-mail bekend op deze aanvraag" };
  }

  const { data: grp, error: grpErr } = await admin
    .from("groups")
    .select("id, tenant_id, name")
    .eq("id", groupId)
    .maybeSingle();
  if (grpErr || !grp) return { ok: false, error: "groep niet gevonden" };
  if (grp.tenant_id !== sub.tenant_id) {
    return { ok: false, error: "groep hoort niet bij deze tenant" };
  }

  const { data: tenantRow, error: tErr } = await admin
    .from("tenants")
    .select("id, slug, domain, name, settings_json")
    .eq("id", sub.tenant_id)
    .maybeSingle();
  if (tErr || !tenantRow) return { ok: false, error: "tenant niet gevonden" };
  const ttlHours = readTtlHours(tenantRow.settings_json);
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

  const { data: offer, error: insErr } = await admin
    .from("intake_slot_offers")
    .insert({
      tenant_id: sub.tenant_id,
      submission_id: submissionId,
      group_id: groupId,
      session_id: sessionId ?? null,
      status: "pending",
      expires_at: expiresAt,
      suggestion_rank: suggestionRank ?? null,
      suggestion_score: suggestionScore ?? null,
      created_by: user.id,
    })
    .select("id, token, expires_at")
    .single();
  if (insErr || !offer) {
    return { ok: false, error: insErr?.message ?? "kon aanbod niet aanmaken" };
  }

  // Slot-offer-links zijn bewust tenant-agnostisch: het token is de
  // enige autoriteit. Door de apex-base te gebruiken voorkomen we dat
  // de middleware de URL rewrite naar /t/<slug>/intake-slot/... (waar
  // geen route bestaat).
  void tenantRow.slug;
  void tenantRow.domain;
  const base = appBaseUrl();
  const acceptUrl = `${base}/intake-slot/${offer.token}/accept`;
  const declineUrl = `${base}/intake-slot/${offer.token}/decline`;
  const expiresLabel = formatExpiresLabel(offer.expires_at);

  void sendEmail({
    tenantId: sub.tenant_id,
    templateKey: "intake_slot_offered",
    to: sub.contact_email,
    triggerSource: "intake.slot_offer.created",
    variables: {
      contact_name: sub.contact_name ?? "",
      group_name: grp.name ?? "",
      accept_url: acceptUrl,
      decline_url: declineUrl,
      expires_label: expiresLabel,
    },
  }).catch((e: unknown) => {
    // eslint-disable-next-line no-console
    console.error("[slot-offer] send email failed:", e);
  });

  void sendNotification({
    tenantId: sub.tenant_id,
    title: "Plek aangeboden",
    contentText: `${sub.contact_name ?? "Een aanvrager"} — plek aangeboden in ${grp.name ?? "een groep"}.`,
    targets: [{ target_type: "role", target_id: "tenant_admin" }],
    sendEmail: false,
    sendPush: false,
    source: "intake_slot_offered",
    sourceRef: offer.id,
    createdBy: user.id,
  }).catch((e: unknown) => {
    // eslint-disable-next-line no-console
    console.error("[slot-offer] send notification failed:", e);
  });

  await recordAudit({
    tenant_id: sub.tenant_id,
    actor_user_id: user.id,
    action: "intake.slot_offer.created",
    meta: {
      submission_id: submissionId,
      group_id: groupId,
      group_name: grp.name ?? null,
      offer_id: offer.id,
      expires_at: offer.expires_at,
      ...(typeof suggestionRank === "number"
        ? { suggestion_rank: suggestionRank }
        : {}),
      ...(typeof suggestionScore === "number"
        ? { suggestion_score: suggestionScore }
        : {}),
    },
  });

  revalidatePath(`/tenant/intake/${submissionId}`);
  return { ok: true, offerId: offer.id };
}

export async function cancelIntakeSlotOffer(input: {
  offerId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input?.offerId) return { ok: false, error: "ongeldige invoer" };
  const admin = createAdminClient();

  const { data: offer, error: offerErr } = await admin
    .from("intake_slot_offers")
    .select("id, tenant_id, submission_id, status")
    .eq("id", input.offerId)
    .maybeSingle();
  if (offerErr || !offer) return { ok: false, error: "aanbod niet gevonden" };
  const user = await assertTenantAccess(offer.tenant_id);
  if (offer.status !== "pending") {
    return { ok: false, error: `aanbod is al ${offer.status}` };
  }

  const { error: updErr } = await admin
    .from("intake_slot_offers")
    .update({ status: "cancelled", used_at: new Date().toISOString() })
    .eq("id", offer.id)
    .eq("tenant_id", offer.tenant_id);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    tenant_id: offer.tenant_id,
    actor_user_id: user.id,
    action: "intake.slot_offer.cancelled",
    meta: { submission_id: offer.submission_id, offer_id: offer.id },
  });
  revalidatePath(`/tenant/intake/${offer.submission_id}`);
  return { ok: true };
}
