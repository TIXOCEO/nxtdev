import { z } from "zod";

/**
 * Catalogue van ondersteunde event keys.
 * Elke key krijgt een default-template-mapping (zie DEFAULT_TRIGGER_TEMPLATE_MAP)
 * en wordt bij eerste seed automatisch ingeschakeld.
 */
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
  "parent_link_no_account",
  "parent_link_existing_account",
  "minor_added_to_parent",
] as const;

export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

/**
 * Default mapping van event_key → template_key, gebruikt bij eerste seed
 * en als fallback wanneer een tenant geen expliciete trigger-rij heeft.
 */
export const DEFAULT_TRIGGER_TEMPLATE_MAP: Record<TriggerEvent, string> = {
  member_created: "welcome_member",
  tryout_registered: "welcome_tryout",
  registration_submitted: "welcome_member",
  registration_converted: "registration_converted",
  membership_assigned: "welcome_member",
  payment_due: "payment_due",
  payment_overdue: "payment_overdue",
  account_invite_sent: "account_invite",
  account_invite_reminder: "invite_reminder",
  account_invite_expired: "invite_expired",
  group_announcement_posted: "group_announcement",
  news_published: "newsletter",
  parent_link_no_account: "parent_register_then_link",
  parent_link_existing_account: "parent_link_with_code",
  minor_added_to_parent: "minor_added",
};

export const upsertTriggerSchema = z.object({
  tenant_id: z.string().uuid(),
  event_key: z.string().trim().min(1),
  template_key: z.string().trim().min(1),
  enabled: z.boolean().default(true),
});
export type UpsertTriggerInput = z.infer<typeof upsertTriggerSchema>;
