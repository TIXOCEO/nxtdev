// Plain (non-"use server") module so the constants and types can be
// imported by both the server action file and client components without
// being stripped from the production bundle. Next.js only allows async
// function exports from "use server" modules — anything else (objects,
// arrays, types) is silently removed and resolves to `undefined` at
// runtime, which previously caused `i.map is not a function` in the
// admin registrations select.

export const TRYOUT_STATUSES = [
  "new",
  "contacted",
  "invited",
  "completed",
  "declined",
] as const;

export const ASPIRANT_STATUSES = [
  "aspirant",
  "accepted",
  "rejected",
  "archived",
] as const;

export const ALL_MEMBERSHIP_STATUSES = [
  ...TRYOUT_STATUSES,
  ...ASPIRANT_STATUSES,
] as const;

export type TryoutStatus = (typeof TRYOUT_STATUSES)[number];
export type AspirantStatus = (typeof ASPIRANT_STATUSES)[number];
export type AdminMembershipStatus = (typeof ALL_MEMBERSHIP_STATUSES)[number];

// Legacy alias kept so existing imports keep compiling.
export type AdminRegistrationStatus = AdminMembershipStatus;
