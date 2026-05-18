import { z } from "zod";

const urlOrPathRefine = (val: string) => /^(https?:\/\/|\/)/.test(val);

export const createChildDiplomaSchema = z.object({
  member_id: z.string().uuid(),
  diploma_name: z.string().trim().min(1).max(120),
  level: z.string().trim().max(40).optional().nullable(),
  awarded_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  awarded_by_member_id: z.string().uuid().optional().nullable(),
  certificate_url: z
    .string()
    .trim()
    .refine(urlOrPathRefine, "Moet beginnen met http(s):// of /")
    .optional()
    .nullable(),
  photo_url: z
    .string()
    .trim()
    .refine(urlOrPathRefine, "Moet beginnen met http(s):// of /")
    .optional()
    .nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const updateChildDiplomaSchema = createChildDiplomaSchema
  .partial()
  .extend({ id: z.string().uuid() });

export type CreateChildDiplomaInput = z.infer<typeof createChildDiplomaSchema>;
export type UpdateChildDiplomaInput = z.infer<typeof updateChildDiplomaSchema>;
