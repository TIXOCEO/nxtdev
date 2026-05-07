import { z } from "zod";

export const MEMBER_STATUSES = [
  "prospect",
  "invited",
  "aspirant",
  "pending",
  "active",
  "paused",
  "inactive",
  "cancelled",
  "archived",
] as const;

export const MEMBER_ROLES = [
  "parent",
  "athlete",
  "trainer",
  "staff",
  "volunteer",
] as const;

const optionalText = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .email("Ongeldig e-mailadres")
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum")
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalGender = z
  .enum(["male", "female", "other"])
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? (v as "male" | "female" | "other") : null));

// Sprint 38 — sector-agnostic: was hardcoded `('player','goalkeeper')`,
// now accepts any short string so non-football tenants can set their own
// participant subtype (or leave it null). DB-side check is dropped in
// `sprint38_player_type_open.sql`.
const optionalPlayerType = z
  .string()
  .trim()
  .max(40)
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const createMemberSchema = z.object({
  tenant_id: z.string().uuid(),
  full_name: z.string().trim().min(2, "Naam is verplicht").max(120),
  email: optionalEmail,
  phone: optionalText,
  member_status: z.enum(MEMBER_STATUSES).default("prospect"),
  roles: z.array(z.enum(MEMBER_ROLES)).default([]),
});

// Sprint F — admin kan alle Sprint 23-velden bewerken via dezelfde update-action.
// Alle nieuwe velden zijn optional zodat we partial-patches blijven ondersteunen
// (de bestaande dynamic-patch implementatie filtert op `undefined`).
export const updateMemberSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120).optional(),
  email: optionalEmail.optional(),
  phone: optionalText.optional(),
  member_status: z.enum(MEMBER_STATUSES).optional(),
  roles: z.array(z.enum(MEMBER_ROLES)).optional(),
  // Sprint 23 / Sprint F — gestructureerde persoons-/adresvelden.
  first_name: optionalText.optional(),
  last_name: optionalText.optional(),
  birth_date: optionalDate.optional(),
  gender: optionalGender.optional(),
  player_type: optionalPlayerType.optional(),
  street: optionalText.optional(),
  house_number: optionalText.optional(),
  postal_code: optionalText.optional(),
  city: optionalText.optional(),
  // Sprint 24 — admin-only velden.
  member_since: optionalDate.optional(),
  notes: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null))
    .optional(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
