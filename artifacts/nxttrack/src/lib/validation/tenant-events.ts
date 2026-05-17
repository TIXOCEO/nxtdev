import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

const optionalUrlOrPath = z
  .string()
  .trim()
  .regex(/^(https?:\/\/|\/)/, "Moet beginnen met http(s):// of /")
  .max(500)
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalIso = z
  .string()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null))
  .refine(
    (v) => v === null || !Number.isNaN(Date.parse(v)),
    "Ongeldige datum",
  );

export const tenantEventStatus = z.enum(["draft", "published", "archived"]);

export const createTenantEventSchema = z
  .object({
    tenant_id: z.string().uuid(),
    title: z.string().trim().min(2, "Titel is verplicht").max(200),
    body: optionalText(4000),
    starts_at: optionalIso,
    ends_at: optionalIso,
    cta_label: optionalText(80),
    cta_url: optionalUrlOrPath,
    cover_image_url: optionalUrlOrPath,
    is_featured: z.boolean().default(false),
    status: tenantEventStatus.default("draft"),
  })
  .superRefine((val, ctx) => {
    if (val.starts_at && val.ends_at) {
      if (Date.parse(val.ends_at) < Date.parse(val.starts_at)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ends_at"],
          message: "Einddatum moet ná startdatum liggen",
        });
      }
    }
    if (val.cta_label && !val.cta_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cta_url"],
        message: "URL is verplicht als je een knop-label hebt",
      });
    }
  });

// Behoud de superRefine van createTenantEventSchema door .and() te gebruiken
// in plaats van `_def.schema.extend({})` (die stript refinements).
export const updateTenantEventSchema = createTenantEventSchema.and(
  z.object({ id: z.string().uuid() }),
);

export type CreateTenantEventInput = z.infer<typeof createTenantEventSchema>;
export type UpdateTenantEventInput = z.infer<typeof updateTenantEventSchema>;
