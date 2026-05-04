import "server-only";

/**
 * Env-driven email configuration (SendGrid API).
 *
 * The SendGrid API key is read once from the process environment.
 * Nothing in the app touches the legacy `email_settings` table any more.
 *
 * Required env vars (set in Replit Secrets / `.env`):
 *   SENDGRID_API_KEY
 *
 * Optional (with sensible defaults):
 *   MAIL_BASE_DOMAIN          — fallback root domain for tenant senders
 *                               (e.g. "nxttrack.nl" → no-reply@<slug>.nxttrack.nl)
 *   MAIL_DEFAULT_FROM_NAME    — used for platform-level test sends
 *   MAIL_DEFAULT_FROM_EMAIL   — used for platform-level test sends
 */

export type MailProvider = "sendgrid";

export interface EmailConfig {
  provider: MailProvider;
  apiKey: string;
  baseDomain: string;
  defaultFromName: string;
  defaultFromEmail: string;
}

function readEnv(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

export function getEmailConfig(): EmailConfig {
  return {
    provider: "sendgrid",
    apiKey: readEnv("SENDGRID_API_KEY") ?? "",
    baseDomain: readEnv("MAIL_BASE_DOMAIN") ?? "nxttrack.nl",
    defaultFromName: readEnv("MAIL_DEFAULT_FROM_NAME") ?? "NXTTRACK",
    defaultFromEmail:
      readEnv("MAIL_DEFAULT_FROM_EMAIL") ?? "no-reply@nxttrack.nl",
  };
}

/**
 * Returns whether the SendGrid API key is present.
 * Never returns the value itself — safe to surface to platform UI.
 */
export interface ProviderStatus {
  provider: MailProvider;
  configured: boolean;
  missing: string[];
}

export function getProviderStatus(): ProviderStatus {
  const c = getEmailConfig();
  const missing: string[] = [];
  if (!c.apiKey) missing.push("SENDGRID_API_KEY");
  return {
    provider: c.provider,
    configured: missing.length === 0,
    missing,
  };
}
