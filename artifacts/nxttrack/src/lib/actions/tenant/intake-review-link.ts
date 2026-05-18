"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import { recordAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send-email";
import { generateReviewToken } from "@/lib/intake/review-token";
import { tenantUrl } from "@/lib/url";

/**
 * Task #145 (Sprint 82d) — Admin-actie: stuur de aanvrager een mail
 * met 3 voorstellen, via een deep-link op de publieke
 * /inschrijven/voorstellen-pagina.
 *
 * Genereert een vers review-token (7 dagen geldig, single-use), update
 * `intake_submissions.review_token_hash` + `review_token_expires_at`,
 * verstuurt de `intake_review_link`-mail en logt audit-event
 * `intake.review_link_sent`. Werkt onafhankelijk van de tenant-instelling
 * `public_intake_propose_slots` — de admin heeft eigen autoriteit via
 * `assertTenantAccess`.
 */

const inputSchema = z.object({
  submissionId: z.string().uuid(),
});

export type SendIntakeReviewLinkInput = z.infer<typeof inputSchema>;

export interface SendIntakeReviewLinkResult {
  ok: boolean;
  error?: string;
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

export async function sendIntakeReviewLink(
  input: SendIntakeReviewLinkInput,
): Promise<SendIntakeReviewLinkResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ongeldige invoer" };
  const { submissionId } = parsed.data;

  const admin = createAdminClient();

  const { data: sub, error: subErr } = await admin
    .from("intake_submissions")
    .select("id, tenant_id, status, contact_name, contact_email")
    .eq("id", submissionId)
    .maybeSingle();
  if (subErr || !sub) return { ok: false, error: "aanvraag niet gevonden" };

  const user = await assertTenantAccess(sub.tenant_id);

  if (!sub.contact_email) {
    return { ok: false, error: "geen contact-e-mail bekend op deze aanvraag" };
  }
  const allowedFrom = ["submitted", "in_review", "needs_review", "waitlisted"];
  if (!allowedFrom.includes(sub.status)) {
    return {
      ok: false,
      error: `voorstellen versturen niet toegestaan vanuit status ${sub.status}`,
    };
  }

  const { data: tenantRow, error: tErr } = await admin
    .from("tenants")
    .select("id, slug, domain, name")
    .eq("id", sub.tenant_id)
    .maybeSingle();
  if (tErr || !tenantRow) return { ok: false, error: "tenant niet gevonden" };

  const { plain, hash, expiresAt } = generateReviewToken();

  const { error: updErr } = await admin
    .from("intake_submissions")
    .update({
      review_token_hash: hash,
      review_token_expires_at: expiresAt,
    })
    .eq("id", sub.id)
    .eq("tenant_id", sub.tenant_id);
  if (updErr) return { ok: false, error: updErr.message };

  const reviewUrl = tenantUrl(
    { slug: tenantRow.slug as string, domain: tenantRow.domain as string | null },
    `/inschrijven/voorstellen?token=${encodeURIComponent(plain)}`,
  );
  const expiresLabel = formatExpiresLabel(expiresAt);

  const mail = await sendEmail({
    tenantId: sub.tenant_id,
    templateKey: "intake_review_link",
    to: sub.contact_email,
    triggerSource: "intake.review_link_sent",
    variables: {
      contact_name: sub.contact_name ?? "",
      review_url: reviewUrl,
      expires_label: expiresLabel,
    },
  });
  if (!mail.ok) {
    return { ok: false, error: mail.error ?? "verzenden mislukt" };
  }

  await recordAudit({
    tenant_id: sub.tenant_id,
    actor_user_id: user.id,
    action: "intake.review_link_sent",
    meta: {
      submission_id: sub.id,
      recipient_email: sub.contact_email,
      expires_at: expiresAt,
    },
  });

  revalidatePath(`/tenant/intake/${submissionId}`);
  return { ok: true };
}
