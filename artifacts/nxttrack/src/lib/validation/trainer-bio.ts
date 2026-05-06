import { z } from "zod";

export const trainerBioFieldTypes = [
  "short_text",
  "long_text",
  "bullet_list",
  "number",
  "date",
] as const;

export const upsertSectionSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1, "Label is verplicht").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const upsertFieldSchema = z.object({
  tenant_id: z.string().uuid(),
  section_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1, "Label is verplicht").max(120),
  field_type: z.enum(trainerBioFieldTypes),
  is_active: z.boolean().default(true),
});

export const reorderSchema = z.object({
  tenant_id: z.string().uuid(),
  ordered_ids: z.array(z.string().uuid()),
});

export const reorderFieldsSchema = reorderSchema.extend({
  section_id: z.string().uuid(),
});

export const deleteSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
});

export const saveAnswerSchema = z.object({
  tenant_id: z.string().uuid(),
  member_id: z.string().uuid(),
  field_id: z.string().uuid(),
  value_text: z.string().nullable().optional(),
  value_number: z.number().nullable().optional(),
  value_date: z.string().nullable().optional(),
  value_list: z.array(z.string()).nullable().optional(),
});

export const saveAnswersBulkSchema = z.object({
  tenant_id: z.string().uuid(),
  member_id: z.string().uuid(),
  answers: z.array(saveAnswerSchema.omit({ tenant_id: true, member_id: true })),
});
