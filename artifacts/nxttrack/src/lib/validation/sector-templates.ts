import { z } from "zod";
import { TerminologySchema } from "@/lib/terminology/schema";

/**
 * Sector-template key formaat: lowercase ASCII, cijfers en underscores;
 * moet starten met een letter. Komt overeen met bestaande seed-keys
 * (`football_school`, `swimming_school`, `generic`).
 */
export const sectorTemplateKeySchema = z
  .string()
  .trim()
  .min(2, "Key is te kort")
  .max(64, "Key is te lang")
  .regex(/^[a-z][a-z0-9_]*$/, "Alleen kleine letters, cijfers en underscores");

const optionalText = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const createSectorTemplateSchema = z.object({
  key: sectorTemplateKeySchema,
  name: z.string().trim().min(1, "Naam is verplicht").max(120),
  description: optionalText,
  terminology_json: TerminologySchema.default({}),
  default_modules_json: z.array(z.unknown()).default([]),
  is_active: z.boolean().default(true),
});

export const updateSectorTemplateSchema = z.object({
  key: sectorTemplateKeySchema,
  name: z.string().trim().min(1).max(120).optional(),
  description: optionalText.optional(),
  terminology_json: TerminologySchema.optional(),
  default_modules_json: z.array(z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

export const deleteSectorTemplateSchema = z.object({
  key: sectorTemplateKeySchema,
});

export const setTenantSectorSchema = z.object({
  tenant_id: z.string().uuid("Ongeldige tenant id"),
  sector_template_key: sectorTemplateKeySchema.nullable(),
  terminology_overrides: TerminologySchema.default({}),
});

export type CreateSectorTemplateInput = z.infer<typeof createSectorTemplateSchema>;
export type UpdateSectorTemplateInput = z.infer<typeof updateSectorTemplateSchema>;
export type DeleteSectorTemplateInput = z.infer<typeof deleteSectorTemplateSchema>;
export type SetTenantSectorInput = z.infer<typeof setTenantSectorSchema>;
