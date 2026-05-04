// Plain (non-"use server") module so the constants and types can be
// imported by both the server-action file and client components without
// being stripped from the production bundle. See registration-statuses.ts
// for the same pattern.

export const INVITE_TYPES = [
  "parent_account",
  "trainer_account",
  "staff_account",
  "adult_athlete_account",
  "minor_parent_link",
  "complete_registration",
  "add_existing_minor",
] as const;

export const INVITE_STATUSES = [
  "pending",
  "sent",
  "opened",
  "accepted",
  "expired",
  "revoked",
] as const;

export type InviteTypeLiteral = (typeof INVITE_TYPES)[number];
export type InviteStatusLiteral = (typeof INVITE_STATUSES)[number];

export const INVITE_TYPE_LABELS: Record<InviteTypeLiteral, string> = {
  parent_account: "Ouder — account",
  trainer_account: "Trainer — account",
  staff_account: "Staf / admin — account",
  adult_athlete_account: "Sporter (volwassen) — account",
  minor_parent_link: "Ouder — koppel minderjarige",
  complete_registration: "Aanmelding afronden",
  add_existing_minor: "Bestaand kind toevoegen",
};

export const INVITE_STATUS_LABELS: Record<InviteStatusLiteral, string> = {
  pending: "In wachtrij",
  sent: "Verzonden",
  opened: "Geopend",
  accepted: "Geaccepteerd",
  expired: "Verlopen",
  revoked: "Ingetrokken",
};

export const INVITE_TEMPLATE_KEY: Record<InviteTypeLiteral, string> = {
  parent_account: "account_invite",
  trainer_account: "staff_invite",
  staff_account: "staff_invite",
  adult_athlete_account: "account_invite",
  minor_parent_link: "parent_link_minor",
  complete_registration: "complete_account",
  add_existing_minor: "minor_added",
};

/**
 * Invite types that should be treated as "team-side" (staff/trainer/admin)
 * by the create-member flow. These get the simplified registration form
 * (name + password only — no player/keeper choice, no kids) and the
 * dedicated `staff_invite` email template with a {{function_label}} variable.
 */
export const STAFF_INVITE_TYPES: ReadonlySet<InviteTypeLiteral> = new Set([
  "trainer_account",
  "staff_account",
]);
