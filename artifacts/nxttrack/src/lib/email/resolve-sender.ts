import "server-only";

import { getEmailConfig } from "@/lib/config/email";
import type { Tenant, TenantEmailSettings } from "@/types/database";
import { slugifyForEmail } from "./slugify-for-email";

export { slugifyForEmail };

export interface ResolvedSender {
  fromName: string;
  fromEmail: string;
}

/**
 * Resolve the From: identity for a tenant-scoped send.
 *
 *   1. If the tenant has a custom domain AND it has been verified with the
 *      email provider (`tenants.email_domain_verified = true`), use
 *      `no-reply@<domain>`.
 *   2. Otherwise fall back to the shared platform sender address
 *      (`MAIL_DEFAULT_FROM_EMAIL`, default `no-reply@nxttrack.nl`) — which
 *      MUST be authenticated in SendGrid. The tenant's display name is still
 *      used so recipients see e.g. `"Voetbalschool Houtrust" <no-reply@nxttrack.nl>`
 *      in their inbox, preserving tenant branding without requiring a
 *      per-tenant DNS / sender-authentication step.
 *
 * The display name comes from `tenant_email_settings.default_sender_name`
 * when provided, else the tenant's display name.
 */
export function resolveSender(
  tenant: Pick<Tenant, "name" | "slug" | "domain"> & {
    email_domain_verified?: boolean | null;
  },
  settings?: Pick<TenantEmailSettings, "default_sender_name"> | null,
): ResolvedSender {
  const cfg = getEmailConfig();
  const fromName =
    settings?.default_sender_name?.trim() || tenant.name || cfg.defaultFromName;

  const verified = tenant.email_domain_verified === true;
  const customDomain = tenant.domain?.trim().toLowerCase();

  const fromEmail =
    verified && customDomain
      ? `no-reply@${customDomain}`
      : cfg.defaultFromEmail;

  return { fromName, fromEmail };
}

/** Default platform sender for non-tenant test sends. */
export function platformSender(): ResolvedSender {
  const cfg = getEmailConfig();
  return { fromName: cfg.defaultFromName, fromEmail: cfg.defaultFromEmail };
}

/**
 * Resolve the Reply-To address for a tenant-scoped send.
 *
 *   1. Use `tenant_email_settings.reply_to_email` when configured.
 *   2. Fall back to `tenants.contact_email` so replies still reach the tenant
 *      instead of the shared platform sender (`no-reply@nxttrack.nl`).
 *   3. Return `undefined` if neither is set — recipients' replies will then
 *      land on the From: address.
 */
export function resolveReplyTo(
  tenant: Pick<Tenant, "contact_email">,
  settings?: Pick<TenantEmailSettings, "reply_to_email"> | null,
): string | undefined {
  const explicit = settings?.reply_to_email?.trim();
  if (explicit) return explicit;
  const contact = tenant.contact_email?.trim();
  if (contact) return contact;
  return undefined;
}
