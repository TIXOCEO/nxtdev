import { z } from "zod";
import { moduleSizeSchema, moduleVisibilitySchema } from "./homepage";
import { getModuleDef } from "@/lib/homepage/module-registry";

/**
 * Sprint 39 — schema voor één entry in `sector_templates.default_modules_json`.
 *
 * Bewust conservatief: alleen de velden die de bestaande
 * `add_tenant_module` RPC kent komen erin. `config` is een vrij record
 * — per-module config-validatie blijft de verantwoordelijkheid van de
 * runtime-renderers (zelfde patroon als bij `updateTenantModuleConfig`).
 */
export const sectorTemplateModuleSchema = z
  .object({
    module_key: z.string().trim().min(1, "module_key is verplicht"),
    size: moduleSizeSchema,
    title: z
      .string()
      .max(160)
      .nullish()
      .transform((v) => (v === undefined ? undefined : v)),
    visible_for: moduleVisibilitySchema.optional(),
    visible_mobile: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((val, ctx) => {
    const def = getModuleDef(val.module_key);
    if (!def) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["module_key"],
        message: `Onbekende module_key "${val.module_key}"`,
      });
      return;
    }
    if (!def.allowedSizes.includes(val.size)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["size"],
        message: `Formaat ${val.size} is niet toegestaan voor module ${val.module_key} (toegestaan: ${def.allowedSizes.join(", ")})`,
      });
    }
  });

export const sectorTemplateModulesSchema = z.array(sectorTemplateModuleSchema);

export type SectorTemplateModule = z.infer<typeof sectorTemplateModuleSchema>;
