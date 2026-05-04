"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantAccess } from "./_assert-access";
import {
  createNewsletterSchema,
  updateNewsletterSchema,
  sendNewsletterSchema,
  deleteNewsletterSchema,
  sendNewsletterTestSchema,
  type CreateNewsletterInput,
  type UpdateNewsletterInput,
  type SendNewsletterInput,
  type DeleteNewsletterInput,
  type SendNewsletterTestInput,
} from "@/lib/validation/newsletters";
import { resolveRecipients } from "@/lib/notifications/resolve-recipients";
import { getEmailConfig } from "@/lib/config/email";
import { resolveSender, resolveReplyTo } from "@/lib/email/resolve-sender";
import { wrapBrandedEmail } from "@/lib/email/branded-wrap";
import { getNewsletterByIdAdmin } from "@/lib/db/newsletters";
import sgMail from "@sendgrid/mail";
import type { Newsletter, Tenant } from "@/types/database";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

// ── CREATE / UPDATE / DELETE drafts ──────────────────────

export async function createNewsletter(
  input: CreateNewsletterInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createNewsletterSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  const user = await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();

  if (
    parsed.data.audience_type === "groups" &&
    parsed.data.audience_group_ids.length === 0
  ) {
    return fail("Selecteer minstens één groep.");
  }

  const { data, error } = await admin
    .from("newsletters")
    .insert({
      tenant_id: parsed.data.tenant_id,
      title: parsed.data.title,
      preheader: parsed.data.preheader,
      content_html: parsed.data.content_html,
      content_text: parsed.data.content_text,
      audience_type: parsed.data.audience_type,
      audience_group_ids: parsed.data.audience_group_ids,
      created_by: user.id,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  revalidatePath("/tenant/newsletters");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateNewsletter(
  input: UpdateNewsletterInput,
): Promise<ActionResult> {
  const parsed = updateNewsletterSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer", parsed.error.flatten().fieldErrors);

  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();

  const existing = await getNewsletterByIdAdmin(parsed.data.id, parsed.data.tenant_id);
  if (!existing) return fail("Nieuwsbrief niet gevonden.");
  if (existing.status !== "draft") {
    return fail("Een verstuurde nieuwsbrief kan niet meer worden bewerkt.");
  }

  if (
    parsed.data.audience_type === "groups" &&
    parsed.data.audience_group_ids.length === 0
  ) {
    return fail("Selecteer minstens één groep.");
  }

  const { error } = await admin
    .from("newsletters")
    .update({
      title: parsed.data.title,
      preheader: parsed.data.preheader,
      content_html: parsed.data.content_html,
      content_text: parsed.data.content_text,
      audience_type: parsed.data.audience_type,
      audience_group_ids: parsed.data.audience_group_ids,
    })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return fail(error.message);

  revalidatePath("/tenant/newsletters");
  revalidatePath(`/tenant/newsletters/${parsed.data.id}`);
  return { ok: true, data: undefined };
}

export async function deleteNewsletter(
  input: DeleteNewsletterInput,
): Promise<ActionResult> {
  const parsed = deleteNewsletterSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer");

  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();

  const existing = await getNewsletterByIdAdmin(parsed.data.id, parsed.data.tenant_id);
  if (!existing) return fail("Nieuwsbrief niet gevonden.");
  if (existing.status === "sending") {
    return fail("Verzending is bezig — wacht tot deze klaar is.");
  }

  const { error } = await admin
    .from("newsletters")
    .delete()
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id);
  if (error) return fail(error.message);

  revalidatePath("/tenant/newsletters");
  return { ok: true, data: undefined };
}

// ── SEND helpers ────────────────────────────────────────

interface RecipientEmail {
  email: string;
  user_id: string;
}

async function loadRecipientEmails(
  tenantId: string,
  audienceType: "all" | "groups",
  audienceGroupIds: string[],
): Promise<RecipientEmail[]> {
  const targets = audienceType === "all"
    ? [{ target_type: "all" as const }]
    : audienceGroupIds.map((id) => ({ target_type: "group" as const, target_id: id }));

  const resolved = await resolveRecipients(tenantId, targets);
  if (resolved.length === 0) return [];

  const admin = createAdminClient();
  const userIds = Array.from(new Set(resolved.map((r) => r.user_id)));
  // Get email per user_id from auth.users via members join (member.user_id ↔ profile.email).
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email")
    .in("id", userIds);

  const emailByUser = new Map<string, string>();
  for (const p of (profiles ?? []) as Array<{ id: string; email: string | null }>) {
    if (p.email) emailByUser.set(p.id, p.email);
  }

  const out: RecipientEmail[] = [];
  const seen = new Set<string>();
  for (const r of resolved) {
    const e = emailByUser.get(r.user_id);
    if (!e) continue;
    const key = e.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ email: e, user_id: r.user_id });
  }
  return out;
}

interface ProviderReady {
  apiKey: string;
}

function providerReady(): ProviderReady | { error: string } {
  const cfg = getEmailConfig();
  if (!cfg.apiKey) {
    return { error: "E-mailprovider niet geconfigureerd (SENDGRID_API_KEY ontbreekt)." };
  }
  return { apiKey: cfg.apiKey };
}

let configuredApiKey: string | null = null;
function ensureApiKey(apiKey: string): void {
  if (configuredApiKey === apiKey) return;
  sgMail.setApiKey(apiKey);
  configuredApiKey = apiKey;
}

function describeSendError(e: unknown): string {
  if (e instanceof Error) {
    const resp = (e as { response?: { body?: { errors?: Array<{ message?: string }> } } }).response;
    const apiErrs = resp?.body?.errors;
    if (Array.isArray(apiErrs) && apiErrs.length > 0) {
      const msgs = apiErrs.map((x) => x?.message).filter(Boolean);
      if (msgs.length > 0) return msgs.join("; ");
    }
    return e.message;
  }
  return "Verzendfout";
}

async function logSend(row: {
  tenant_id: string;
  recipient_email: string;
  subject: string;
  status: "sent" | "failed";
  error_message?: string | null;
  from_email: string;
  trigger_source: string;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("email_logs").insert({
    tenant_id: row.tenant_id,
    template_key: null,
    recipient_email: row.recipient_email,
    subject: row.subject,
    status: row.status,
    error_message: row.error_message ?? null,
    trigger_source: row.trigger_source,
    provider: "sendgrid",
    from_email: row.from_email,
  });
}

// ── SEND NOW ────────────────────────────────────────────

export async function sendNewsletterNow(
  input: SendNewsletterInput,
): Promise<ActionResult<{ recipient_count: number; sent_count: number; failed_count: number }>> {
  const parsed = sendNewsletterSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer");

  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();

  // Load + lock the row by setting status='sending' (only if currently 'draft' or 'failed').
  const { data: lockedRow, error: lockErr } = await admin
    .from("newsletters")
    .update({ status: "sending", last_error: null })
    .eq("id", parsed.data.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .in("status", ["draft", "failed"])
    .select("*")
    .maybeSingle();
  if (lockErr) return fail(lockErr.message);
  if (!lockedRow) return fail("Nieuwsbrief is al verstuurd of wordt nu verwerkt.");

  const newsletter = lockedRow as Newsletter;

  // Tenant for branded wrap + sender.
  const { data: tenantRow, error: tenantErr } = await admin
    .from("tenants")
    .select(
      "id, name, slug, domain, email_domain_verified, logo_url, primary_color, contact_email, settings_json, status, created_at, updated_at",
    )
    .eq("id", parsed.data.tenant_id)
    .maybeSingle();
  if (tenantErr || !tenantRow) {
    await admin
      .from("newsletters")
      .update({ status: "failed", last_error: tenantErr?.message ?? "Tenant niet gevonden." })
      .eq("id", newsletter.id);
    return fail(tenantErr?.message ?? "Tenant niet gevonden.");
  }
  const tenant = tenantRow as Tenant;

  const { data: tenantSettings } = await admin
    .from("tenant_email_settings")
    .select("emails_enabled, default_sender_name, reply_to_email")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (tenantSettings && tenantSettings.emails_enabled === false) {
    await admin
      .from("newsletters")
      .update({ status: "failed", last_error: "Tenant e-mails staan uit." })
      .eq("id", newsletter.id);
    return fail("Tenant e-mails staan uit.");
  }

  const ready = providerReady();
  if ("error" in ready) {
    await admin
      .from("newsletters")
      .update({ status: "failed", last_error: ready.error })
      .eq("id", newsletter.id);
    return fail(ready.error);
  }

  const recipients = await loadRecipientEmails(
    tenant.id,
    newsletter.audience_type as "all" | "groups",
    newsletter.audience_group_ids,
  );

  if (recipients.length === 0) {
    await admin
      .from("newsletters")
      .update({
        status: "failed",
        last_error: "Geen ontvangers gevonden voor deze doelgroep.",
        recipient_count: 0,
      })
      .eq("id", newsletter.id);
    return fail("Geen ontvangers gevonden voor deze doelgroep.");
  }

  const sender = resolveSender(tenant, tenantSettings ?? null);
  const fromIdentity = { email: sender.fromEmail, name: sender.fromName };

  const wrapped = wrapBrandedEmail({
    tenant,
    innerHtml: newsletter.content_html,
    innerText: newsletter.content_text,
    preheader: newsletter.preheader,
  });

  ensureApiKey(ready.apiKey);

  let sent = 0;
  let failed = 0;
  // Sequential — keeps memory low and avoids SendGrid rate spikes for v1.
  // Future v2: chunk in parallel batches of 10.
  for (const r of recipients) {
    try {
      await sgMail.send({
        from: fromIdentity,
        to: r.email,
        subject: newsletter.title,
        html: wrapped.html,
        text: wrapped.text,
        replyTo: resolveReplyTo(tenant, tenantSettings ?? null),
      });
      sent++;
      await logSend({
        tenant_id: tenant.id,
        recipient_email: r.email,
        subject: newsletter.title,
        status: "sent",
        from_email: sender.fromEmail,
        trigger_source: `newsletter:${newsletter.id}`,
      });
    } catch (e) {
      failed++;
      const msg = describeSendError(e);
      await logSend({
        tenant_id: tenant.id,
        recipient_email: r.email,
        subject: newsletter.title,
        status: "failed",
        error_message: msg,
        from_email: sender.fromEmail,
        trigger_source: `newsletter:${newsletter.id}`,
      });
    }
  }

  const finalStatus = failed === recipients.length ? "failed" : "sent";

  await admin
    .from("newsletters")
    .update({
      status: finalStatus,
      recipient_count: recipients.length,
      sent_count: sent,
      failed_count: failed,
      sent_at: new Date().toISOString(),
      last_error: failed > 0 && sent === 0 ? "Alle verzendingen mislukt." : null,
    })
    .eq("id", newsletter.id);

  revalidatePath("/tenant/newsletters");
  revalidatePath(`/tenant/newsletters/${newsletter.id}`);
  return {
    ok: true,
    data: { recipient_count: recipients.length, sent_count: sent, failed_count: failed },
  };
}

// ── SEND TEST (single address, no recipient resolution) ─

export async function sendNewsletterTest(
  input: SendNewsletterTestInput,
): Promise<ActionResult> {
  const parsed = sendNewsletterTestSchema.safeParse(input);
  if (!parsed.success) return fail("Ongeldige invoer");

  await assertTenantAccess(parsed.data.tenant_id);
  const admin = createAdminClient();

  const newsletter = await getNewsletterByIdAdmin(parsed.data.id, parsed.data.tenant_id);
  if (!newsletter) return fail("Nieuwsbrief niet gevonden.");

  const { data: tenantRow } = await admin
    .from("tenants")
    .select(
      "id, name, slug, domain, email_domain_verified, logo_url, primary_color, contact_email, settings_json, status, created_at, updated_at",
    )
    .eq("id", parsed.data.tenant_id)
    .maybeSingle();
  if (!tenantRow) return fail("Tenant niet gevonden.");
  const tenant = tenantRow as Tenant;

  const { data: tenantSettings } = await admin
    .from("tenant_email_settings")
    .select("emails_enabled, default_sender_name, reply_to_email")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (tenantSettings && tenantSettings.emails_enabled === false) {
    return fail("Tenant e-mails staan uit.");
  }

  const ready = providerReady();
  if ("error" in ready) return fail(ready.error);

  const sender = resolveSender(tenant, tenantSettings ?? null);
  const wrapped = wrapBrandedEmail({
    tenant,
    innerHtml: newsletter.content_html,
    innerText: newsletter.content_text,
    preheader: newsletter.preheader,
  });

  ensureApiKey(ready.apiKey);

  try {
    await sgMail.send({
      from: { email: sender.fromEmail, name: sender.fromName },
      to: parsed.data.to,
      subject: `[TEST] ${newsletter.title}`,
      html: wrapped.html,
      text: wrapped.text,
      replyTo: resolveReplyTo(tenant, tenantSettings ?? null),
    });
    await logSend({
      tenant_id: tenant.id,
      recipient_email: parsed.data.to,
      subject: `[TEST] ${newsletter.title}`,
      status: "sent",
      from_email: sender.fromEmail,
      trigger_source: `newsletter_test:${newsletter.id}`,
    });
    return { ok: true, data: undefined };
  } catch (e) {
    const msg = describeSendError(e);
    await logSend({
      tenant_id: tenant.id,
      recipient_email: parsed.data.to,
      subject: `[TEST] ${newsletter.title}`,
      status: "failed",
      error_message: msg,
      from_email: sender.fromEmail,
      trigger_source: `newsletter_test:${newsletter.id}`,
    });
    return fail(msg);
  }
}
