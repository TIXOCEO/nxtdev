import { z } from "zod";
import { slugify } from "@/lib/utils/slug";

const slugSchema = z
  .string()
  .transform((v) => slugify(v))
  .pipe(
    z
      .string()
      .min(3, "Slug moet minstens 3 tekens lang zijn")
      .max(120)
      .regex(
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
        "Slug mag alleen kleine letters, cijfers en streepjes bevatten",
      ),
  );

export const newsCategorySchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
});

const optionalText = z
  .string()
  .trim()
  .max(300, "Excerpt must be 300 characters or fewer")
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalUuid = z
  .string()
  .uuid()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalUrl = z
  .string()
  .trim()
  .url()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const createNewsPostSchema = z
  .object({
    tenant_id: z.string().uuid(),
    title: z.string().trim().min(2, "Title is required").max(200),
    slug: slugSchema,
    excerpt: optionalText,
    category_id: optionalUuid,
    cover_image_url: optionalUrl,
    status: z.enum(["draft", "published"]).default("draft"),
    content_json: z.record(z.string(), z.unknown()).nullable().optional(),
    content_html: z.string().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status === "published") {
      if (!val.content_html || val.content_html.replace(/<[^>]*>/g, "").trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content_html"],
          message: "Content is required to publish",
        });
      }
      if (!val.content_json) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content_json"],
          message: "Editor content is required to publish",
        });
      }
    }
  });

export const updateNewsPostSchema = z
  .object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    title: z.string().trim().min(2).max(200).optional(),
    slug: slugSchema.optional(),
    excerpt: optionalText.optional(),
    category_id: optionalUuid.optional(),
    cover_image_url: optionalUrl.optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    content_json: z.record(z.string(), z.unknown()).nullable().optional(),
    content_html: z.string().nullable().optional(),
  });

export type NewsCategoryInput = z.infer<typeof newsCategorySchema>;
export type CreateNewsPostInput = z.infer<typeof createNewsPostSchema>;
export type UpdateNewsPostInput = z.infer<typeof updateNewsPostSchema>;
