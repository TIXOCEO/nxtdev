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

export const createMemberSchema = z.object({
  tenant_id: z.string().uuid(),
  full_name: z.string().trim().min(2, "Naam is verplicht").max(120),
  email: optionalEmail,
  phone: optionalText,
  member_status: z.enum(MEMBER_STATUSES).default("prospect"),
  roles: z.array(z.enum(MEMBER_ROLES)).default([]),
});

export const updateMemberSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120).optional(),
  email: optionalEmail.optional(),
  phone: optionalText.optional(),
  member_status: z.enum(MEMBER_STATUSES).optional(),
  roles: z.array(z.enum(MEMBER_ROLES)).optional(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
