import { z } from "zod";

export const newsletterAudienceSchema = z.discriminatedUnion("audience_type", [
  z.object({ audience_type: z.literal("all") }),
  z.object({
    audience_type: z.literal("groups"),
    audience_group_ids: z
      .array(z.string().uuid())
      .min(1, "Selecteer minstens één groep."),
  }),
]);

export const createNewsletterSchema = z.object({
  tenant_id: z.string().uuid(),
  title: z.string().trim().min(1, "Titel is verplicht.").max(200),
  preheader: z
    .string()
    .trim()
    .max(200, "Preheader is te lang (max 200 tekens).")
    .nullish()
    .transform((v) => (v ? v : null)),
  content_html: z.string().default(""),
  content_text: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null)),
  audience_type: z.enum(["all", "groups"]).default("all"),
  audience_group_ids: z.array(z.string().uuid()).default([]),
});
export type CreateNewsletterInput = z.infer<typeof createNewsletterSchema>;

export const updateNewsletterSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  title: z.string().trim().min(1, "Titel is verplicht.").max(200),
  preheader: z
    .string()
    .trim()
    .max(200, "Preheader is te lang (max 200 tekens).")
    .nullish()
    .transform((v) => (v ? v : null)),
  content_html: z.string().default(""),
  content_text: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null)),
  audience_type: z.enum(["all", "groups"]).default("all"),
  audience_group_ids: z.array(z.string().uuid()).default([]),
});
export type UpdateNewsletterInput = z.infer<typeof updateNewsletterSchema>;

export const sendNewsletterSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
});
export type SendNewsletterInput = z.infer<typeof sendNewsletterSchema>;

export const deleteNewsletterSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
});
export type DeleteNewsletterInput = z.infer<typeof deleteNewsletterSchema>;

export const sendNewsletterTestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  to: z.string().trim().email("Ongeldig e-mailadres."),
});
export type SendNewsletterTestInput = z.infer<typeof sendNewsletterTestSchema>;
