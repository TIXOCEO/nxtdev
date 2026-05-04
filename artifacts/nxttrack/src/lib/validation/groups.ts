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
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
