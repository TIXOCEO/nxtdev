import { z } from "zod";

/** Catalogue of supported event keys (config-only in Sprint 9). */
export const TRIGGER_EVENTS = [
  "member_created",
  "tryout_registered",
  "registration_submitted",
  "registration_converted",
  "membership_assigned",
  "payment_due",
  "payment_overdue",
  "account_invite_sent",
  "account_invite_reminder",
  "account_invite_expired",
  "group_announcement_posted",
  "news_published",
] as const;

export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

export const upsertTriggerSchema = z.object({
  tenant_id: z.string().uuid(),
  event_key: z.string().trim().min(1),
  template_key: z.string().trim().min(1),
  enabled: z.boolean().default(true),
});
export type UpsertTriggerInput = z.infer<typeof upsertTriggerSchema>;
