import { z } from "zod";

export const TRAINER_DOCUMENT_CATEGORIES = [
  "handleiding",
  "protocol",
  "formulier",
  "overig",
] as const;

const urlOrPathRefine = (val: string) => /^(https?:\/\/|\/)/.test(val);

export const createTrainerDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  file_url: z
    .string()
    .trim()
    .min(1)
    .refine(urlOrPathRefine, "Moet beginnen met http(s):// of /"),
  file_type: z.string().trim().max(80).optional().nullable(),
  category: z.enum(TRAINER_DOCUMENT_CATEGORIES).default("overig"),
});

export const updateTrainerDocumentSchema = createTrainerDocumentSchema
  .partial()
  .extend({
    id: z.string().uuid(),
    is_archived: z.boolean().optional(),
  });

export type CreateTrainerDocumentInput = z.infer<typeof createTrainerDocumentSchema>;
export type UpdateTrainerDocumentInput = z.infer<typeof updateTrainerDocumentSchema>;
