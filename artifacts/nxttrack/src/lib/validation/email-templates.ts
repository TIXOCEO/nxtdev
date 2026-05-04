import { z } from "zod";

/** Stable identifiers for the seeded default templates. */
export const TEMPLATE_KEYS = [
  "welcome_member",
  "welcome_tryout",
  "notification",
  "newsletter",
  "payment_due",
  "payment_overdue",
  "account_invite",
  "staff_invite",
  "complete_account",
  "parent_link_minor",
  "minor_added",
  "athlete_code_link",
  "invite_expired",
  "invite_reminder",
  "registration_converted",
  "group_announcement",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

const optionalText = z
  .string()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const updateEmailTemplateSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  subject: z.string().trim().min(1, "Onderwerp is verplicht.").max(300),
  content_html: z.string().min(1, "HTML-inhoud is verplicht."),
  content_text: optionalText,
  is_enabled: z.boolean().default(true),
});
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;

export const toggleEmailTemplateSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  is_enabled: z.boolean(),
});
export type ToggleEmailTemplateInput = z.infer<typeof toggleEmailTemplateSchema>;

export const sendTestEmailSchema = z.object({
  tenant_id: z.string().uuid(),
  template_key: z.string().trim().min(1),
  to: z.string().trim().email("Ongeldig e-mailadres."),
});
export type SendTestEmailInput = z.infer<typeof sendTestEmailSchema>;
