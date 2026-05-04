import { z } from "zod";

const optionalEmail = z
  .string()
  .trim()
  .email()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalText = z
  .string()
  .trim()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const intCoerced = z.union([
  z.number().int().min(0).max(365),
  z
    .string()
    .trim()
    .regex(/^\d+$/, "Moet een geheel getal zijn")
    .transform((v) => Number(v))
    .refine((n) => n >= 0 && n <= 365, "Bereik 0–365"),
]);

export const upsertTenantEmailSettingsSchema = z.object({
  tenant_id: z.string().uuid(),
  emails_enabled: z.boolean().default(true),
  default_sender_name: optionalText,
  reply_to_email: optionalEmail,
  invite_expiry_days: intCoerced.default(2),
  max_resend_count: intCoerced.default(3),
  resend_cooldown_days: intCoerced.default(1),
  reminder_enabled: z.boolean().default(true),
  reminder_after_days: intCoerced.default(1),
});
export type UpsertTenantEmailSettingsInput = z.input<
  typeof upsertTenantEmailSettingsSchema
>;
