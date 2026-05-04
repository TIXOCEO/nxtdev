import { z } from "zod";

export const moduleSizeSchema = z.enum(["1x1", "1x2", "2x1"]);
export const moduleVisibilitySchema = z.enum(["public", "logged_in"]);

export const addTenantModuleSchema = z.object({
  tenant_id: z.string().uuid(),
  module_key: z.string().min(1, "Module is verplicht"),
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

export const updateTenantModuleConfigSchema = z.object({
  tenant_id: z.string().uuid(),
  module_id: z.string().uuid(),
  config: z.record(z.string(), z.unknown()),
});

export const deleteTenantModuleSchema = z.object({
  tenant_id: z.string().uuid(),
  module_id: z.string().uuid(),
});
