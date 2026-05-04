import { z } from "zod";

export const createMediaWallItemSchema = z.object({
  tenant_id: z.string().uuid(),
  title: z.string().max(160).nullable().optional(),
  media_url: z
    .string()
    .trim()
    .min(1, "URL is verplicht")
    .refine((s) => /^https?:\/\//i.test(s), "URL moet beginnen met http(s)://"),
  media_type: z.enum(["image", "video"]),
  is_active: z.boolean().default(true),
});
