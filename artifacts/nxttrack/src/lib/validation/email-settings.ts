import { z } from "zod";

/**
 * SendGrid API key is read from env (SENDGRID_API_KEY).
 * Only the platform "send raw test email" form is validated here.
 */

export const sendRawTestEmailSchema = z.object({
  to: z.string().trim().email("Invalid recipient email."),
  subject: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .default("NXTTRACK SendGrid test"),
  body: z
    .string()
    .trim()
    .min(1)
    .default("This is a test email from NXTTRACK."),
  /** Optional — when set, From: is resolved against this tenant. */
  tenant_id: z.string().uuid().nullish(),
});
export type SendRawTestEmailInput = z.input<typeof sendRawTestEmailSchema>;
