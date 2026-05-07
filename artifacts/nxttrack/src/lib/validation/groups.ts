import { z } from "zod";

export const createGroupSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().trim().min(2, "Naam is verplicht").max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  // Sprint 42 — optionele harde limiet. Lege input → null (ongelimiteerd).
  max_members: z
    .union([z.number().int().positive().max(10_000), z.literal("")])
    .nullish()
    .transform((v) => (v === "" || v == null ? null : v)),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = createGroupSchema.extend({
  id: z.string().uuid(),
});
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
