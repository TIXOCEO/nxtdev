import { z } from "zod";

export const moduleSizeSchema = z.enum(["1x1", "1x2", "2x1", "2x2"]);
export const moduleVisibilitySchema = z.enum(["public", "logged_in"]);

/** Sprint 22 — bij toevoegen kiest de gebruiker direct de grootte. */
export const addTenantModuleSchema = z.object({
  tenant_id: z.string().uuid(),
  module_key: z.string().min(1, "Module is verplicht"),
  size: moduleSizeSchema,
});

export const updateTenantModuleSchema = z.object({
  tenant_id: z.string().uuid(),
  module_id: z.string().uuid(),
  title: z.string().max(160).nullable().optional(),
  size: moduleSizeSchema.optional(),
  visible_for: moduleVisibilitySchema.optional(),
  visible_mobile: z.boolean().optional(),
});

export const reorderTenantModulesSchema = z.object({
  tenant_id: z.string().uuid(),
  ordered_ids: z.array(z.string().uuid()).min(1, "Minstens één module"),
});

/**
 * Sprint 22 — 2D layout opslaan.
 * Per item: x ∈ {0,1}, y ≥ 0, w ∈ {1,2}, h ∈ {1,2}.
 * Hero-sliders (full-bleed) hebben altijd x=0, w=2.
 */
export const layoutItemSchema = z.object({
  id: z.string().uuid(),
  x: z.number().int().min(0).max(1),
  y: z.number().int().min(0).max(199),
  w: z.number().int().min(1).max(2),
  h: z.number().int().min(1).max(2),
});

export const updateModuleLayoutSchema = z.object({
  tenant_id: z.string().uuid(),
  items: z.array(layoutItemSchema).min(1),
});

export const updateTenantModuleConfigSchema = z.object({
  tenant_id: z.string().uuid(),
  module_id: z.string().uuid(),
  config: z.record(z.string(), z.unknown()),
});

export const deleteTenantModuleSchema = z.object({
  tenant_id: z.string().uuid(),
  module_id: z.string().uuid(),
});
