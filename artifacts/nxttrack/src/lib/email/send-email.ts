import "server-only";

import sgMail from "@sendgrid/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailConfig, type EmailConfig } from "@/lib/config/email";
import { resolveSender, platformSender, resolveReplyTo } from "./resolve-sender";
import {
  renderTemplate,
  type TemplateVariables,
} from "./template-renderer";
import { wrapBrandedEmail } from "./branded-wrap";
import type { Tenant } from "@/types/database";

/**
 * Server-only email pipeline (SendGrid API).
 *
 * Flow:
 *   1. Read the SendGrid API key from the environment
 *   2. Load the tenant + tenant_email_settings + template
 *   3. Resolve the tenant-branded From: identity
 *   4. Substitute mustache variables
 *   5. Dispatch via the @sendgrid/mail SDK
 *   6. Always log to `email_logs` (success or failure), incl. provider
 *
 * Callers MUST themselves enforce tenant access (assertTenantAccess /
 * requirePlatformAdmin) before invoking these functions. The functions
 * here never return the API credentials.
 */

export interface SendEmailParams {
  tenantId: string;
  templateKey: string;
  to: string;
  variables?: TemplateVariables;
  triggerSource?: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
  messageId?: string;
  fromEmail?: string;
}

let configuredApiKey: string | null = null;

function ensureApiKey(cfg: EmailConfig): void {
  if (configuredApiKey === cfg.apiKey) return;
  sgMail.setApiKey(cfg.apiKey);
  configuredApiKey = cfg.apiKey;
}

/** Drop the cached API-key fingerprint — call after env changes. */
export function resetEmailProvider(): void {
  configuredApiKey = null;
}

async function logSend(row: {
  tenant_id: string | null;
  template_key: string | null;
  recipient_email: string;
  subject: string | null;
  status: "sent" | "failed";
  error_message?: string | null;
  trigger_source?: string | null;
  provider: string;
  from_email: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("email_logs").insert({
    tenant_id: row.tenant_id,
    template_key: row.template_key,
    recipient_email: row.recipient_email,
    subject: row.subject,
    status: row.status,
    error_message: row.error_message ?? null,
    trigger_source: row.trigger_source ?? null,
    provider: row.provider,
    from_email: row.from_email,
  });
  if (error) {
    // Logging failure must never break the calling flow.
    // eslint-disable-next-line no-console
    console.error("[email] failed to write log:", error.message);
  }
}

function providerReady(cfg: EmailConfig): string | null {
  if (!cfg.apiKey) return "SendGrid not configured (missing SENDGRID_API_KEY).";
  return null;
}

function extractMessageId(headers: Record<string, string> | undefined): string | undefined {
  if (!headers) return undefined;
  const raw =
    headers["x-message-id"] ??
    headers["X-Message-Id"] ??
    headers["x-message-Id"];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

function describeSendError(e: unknown): string {
  if (e instanceof Error) {
    // SendGrid API errors carry a `response.body.errors[]` array.
    const resp = (e as { response?: { body?: { errors?: Array<{ message?: string }> } } }).response;
    const apiErrs = resp?.body?.errors;
    if (Array.isArray(apiErrs) && apiErrs.length > 0) {
      const msgs = apiErrs.map((x) => x?.message).filter(Boolean);
      if (msgs.length > 0) return msgs.join("; ");
    }
    return e.message;
  }
  return "Send failed.";
}

/**
 * Render and send a tenant-scoped email. Always logs to `email_logs`.
 * Never throws on send failure — returns `{ ok: false, error }`.
 */
export async function sendEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const { tenantId, templateKey, to, variables = {}, triggerSource } = params;
  const cfg = getEmailConfig();

  const baseLog = {
    tenant_id: tenantId,
    template_key: templateKey,
    recipient_email: to,
    trigger_source: triggerSource ?? null,
    provider: cfg.provider,
  };

  const notReady = providerReady(cfg);
  if (notReady) {
    await logSend({
      ...baseLog,
      subject: null,
      status: "failed",
      error_message: notReady,
      from_email: null,
    });
    return { ok: false, error: notReady };
  }

  const admin = createAdminClient();

  // 1. tenant + tenant settings
  const [{ data: tenantRow, error: tenantErr }, { data: tenantSettings }] =
    await Promise.all([
      admin
        .from("tenants")
        .select(
          "id, name, slug, domain, email_domain_verified, logo_url, primary_color, contact_email",
        )
        .eq("id", tenantId)
        .maybeSingle(),
      admin
        .from("tenant_email_settings")
        .select("emails_enabled, default_sender_name, reply_to_email")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

  if (tenantErr || !tenantRow) {
    const msg = tenantErr?.message ?? "Tenant not found.";
    await logSend({
      ...baseLog,
      subject: null,
      status: "failed",
      error_message: msg,
      from_email: null,
    });
    return { ok: false, error: msg };
  }

  if (tenantSettings && tenantSettings.emails_enabled === false) {
    const msg = "Tenant emails are disabled.";
    await logSend({
      ...baseLog,
      subject: null,
      status: "failed",
      error_message: msg,
      from_email: null,
    });
    return { ok: false, error: msg };
  }

  const sender = resolveSender(tenantRow as Tenant, tenantSettings ?? null);

  // 2. template
  const { data: template, error: tplErr } = await admin
    .from("email_templates")
    .select("subject, content_html, content_text, is_enabled")
    .eq("tenant_id", tenantId)
    .eq("key", templateKey)
    .maybeSingle();
  if (tplErr) {
    const msg = `Cannot load template: ${tplErr.message}`;
    await logSend({
      ...baseLog,
      subject: null,
      status: "failed",
      error_message: msg,
      from_email: sender.fromEmail,
    });
    return { ok: false, error: msg };
  }
  if (!template) {
    const msg = `Template "${templateKey}" not found.`;
    await logSend({
      ...baseLog,
      subject: null,
      status: "failed",
      error_message: msg,
      from_email: sender.fromEmail,
    });
    return { ok: false, error: msg };
  }
  if (template.is_enabled === false) {
    const msg = `Template "${templateKey}" is disabled.`;
    await logSend({
      ...baseLog,
      subject: null,
      status: "failed",
      error_message: msg,
      from_email: sender.fromEmail,
    });
    return { ok: false, error: msg };
  }

  // 3. render
  const rendered = renderTemplate(
    {
      subject: template.subject,
      content_html: template.content_html,
      content_text: template.content_text,
    },
    variables,
  );

  // 4. wrap with branded layout (logo header + footer + opt-out disclaimer)
  const wrapped = wrapBrandedEmail({
    tenant: tenantRow as Tenant,
    innerHtml: rendered.html,
    innerText: rendered.text,
  });

  // 5. send
  ensureApiKey(cfg);
  try {
    const [response] = await sgMail.send({
      from: { email: sender.fromEmail, name: sender.fromName },
      to,
      subject: rendered.subject,
      html: wrapped.html,
      text: wrapped.text,
      replyTo: resolveReplyTo(tenantRow as Tenant, tenantSettings ?? null),
    });
    const messageId = extractMessageId(
      response?.headers as Record<string, string> | undefined,
    );
    await logSend({
      ...baseLog,
      subject: rendered.subject,
      status: "sent",
      from_email: sender.fromEmail,
    });
    return { ok: true, messageId, fromEmail: sender.fromEmail };
  } catch (e) {
    const msg = describeSendError(e);
    await logSend({
      ...baseLog,
      subject: rendered.subject,
      status: "failed",
      error_message: msg,
      from_email: sender.fromEmail,
    });
    return { ok: false, error: msg };
  }
}

/**
 * Platform-only: dispatch a raw test email.
 *
 * If `tenantId` is supplied, the From: identity is resolved against that
 * tenant (verifying the domain-fallback rule end-to-end). Otherwise the
 * platform default sender (`MAIL_DEFAULT_FROM_*` env) is used.
 *
 * No template lookup; subject and body are taken verbatim.
 */
export async function sendRawEmail(params: {
  to: string;
  subject: string;
  text: string;
  tenantId?: string | null;
  triggerSource?: string;
}): Promise<SendEmailResult> {
  const cfg = getEmailConfig();
  const triggerSource = params.triggerSource ?? "platform_test";

  const baseLog = {
    tenant_id: params.tenantId ?? null,
    template_key: null,
    recipient_email: params.to,
    subject: params.subject,
    trigger_source: triggerSource,
    provider: cfg.provider,
  };

  const notReady = providerReady(cfg);
  if (notReady) {
    await logSend({
      ...baseLog,
      status: "failed",
      error_message: notReady,
      from_email: null,
    });
    return { ok: false, error: notReady };
  }

  // Resolve sender (tenant-branded if requested, else platform default).
  let sender = platformSender();
  if (params.tenantId) {
    const admin = createAdminClient();
    const { data: tenantRow, error: tErr } = await admin
      .from("tenants")
      .select("id, name, slug, domain, email_domain_verified")
      .eq("id", params.tenantId)
      .maybeSingle();
    if (tErr || !tenantRow) {
      const msg = tErr?.message ?? "Tenant not found.";
      await logSend({
        ...baseLog,
        status: "failed",
        error_message: msg,
        from_email: null,
      });
      return { ok: false, error: msg };
    }
    sender = resolveSender(tenantRow as Tenant, null);
  }

  ensureApiKey(cfg);
  try {
    const [response] = await sgMail.send({
      from: { email: sender.fromEmail, name: sender.fromName },
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
    const messageId = extractMessageId(
      response?.headers as Record<string, string> | undefined,
    );
    await logSend({
      ...baseLog,
      status: "sent",
      from_email: sender.fromEmail,
    });
    return { ok: true, messageId, fromEmail: sender.fromEmail };
  } catch (e) {
    const msg = describeSendError(e);
    await logSend({
      ...baseLog,
      status: "failed",
      error_message: msg,
      from_email: sender.fromEmail,
    });
    return { ok: false, error: msg };
  }
}

/**
 * Verify the email provider configuration.
 *
 * SendGrid has no connection-level handshake (it's HTTPS-per-request),
 * so we validate the API key by issuing a cheap authenticated GET to
 * /v3/scopes. A successful 2xx confirms the key is valid and active.
 */
export async function verifyEmailProvider(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const cfg = getEmailConfig();
  const notReady = providerReady(cfg);
  if (notReady) return { ok: false, error: notReady };
  try {
    const res = await fetch("https://api.sendgrid.com/v3/scopes", {
      method: "GET",
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { errors?: Array<{ message?: string }> };
        const msgs = body?.errors?.map((x) => x?.message).filter(Boolean);
        if (msgs && msgs.length > 0) detail = msgs.join("; ");
      } catch {
        /* ignore */
      }
      return { ok: false, error: `SendGrid auth failed: ${detail}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Verify failed.",
    };
  }
}
