import { z } from "zod";

const Uuid = z.string().uuid();

export const VISIBILITY_VALUES = ["public", "internal", "archived"] as const;
export type ProgramVisibility = (typeof VISIBILITY_VALUES)[number];

const Slug = z
  .string()
  .trim()
  .min(2, "Slug is te kort")
  .max(80, "Slug is te lang")
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Alleen kleine letters, cijfers en koppelteken");

const NullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : v));

const PositiveIntNullable = z
  .union([z.number().int(), z.string()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Moet een positief geheel getal zijn")
  .nullable()
  .default(null);

const NonNegIntNullable = z
  .union([z.number().int(), z.string()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 0), "Moet 0 of meer zijn")
  .nullable()
  .default(null);

const NonNegIntDefault = (def: number) =>
  z
    .union([z.number().int(), z.string()])
    .transform((v) => (v === "" || v === null || v === undefined ? def : Number(v)))
    .refine((v) => Number.isInteger(v) && v >= 0, "Moet 0 of meer zijn")
    .default(def);

export const createProgramSchema = z.object({
  tenant_id: Uuid,
  name: z.string().trim().min(2, "Naam is verplicht").max(200),
  slug: Slug,
  visibility: z.enum(VISIBILITY_VALUES).default("internal"),
  public_slug: NullableTrimmed(80).pipe(
    z
      .string()
      .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Alleen kleine letters, cijfers en koppelteken")
      .nullable(),
  ),
  default_capacity: PositiveIntNullable,
  default_flex_capacity: NonNegIntNullable,
  default_min_instructors: NonNegIntDefault(1),
}).refine(
  (v) => v.visibility !== "public" || (v.public_slug != null && v.public_slug.length >= 2),
  { path: ["public_slug"], message: "Publieke slug is verplicht bij zichtbaarheid 'publiek'" },
);
export type CreateProgramInput = z.infer<typeof createProgramSchema>;

export const updateProgramSchema = z.object({
  tenant_id: Uuid,
  id: Uuid,
  name: z.string().trim().min(2).max(200),
  slug: Slug,
  public_slug: NullableTrimmed(80).pipe(
    z
      .string()
      .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Alleen kleine letters, cijfers en koppelteken")
      .nullable(),
  ),
  marketing_title: NullableTrimmed(200),
  marketing_description: NullableTrimmed(4000),
  hero_image_url: NullableTrimmed(500),
  cta_label: NullableTrimmed(60),
  default_capacity: PositiveIntNullable,
  default_flex_capacity: NonNegIntNullable,
  default_min_instructors: NonNegIntDefault(1),
  age_min: NonNegIntNullable,
  age_max: NonNegIntNullable,
  sort_order: NonNegIntDefault(0),
}).refine(
  (v) => v.age_max == null || v.age_min == null || v.age_max >= v.age_min,
  { path: ["age_max"], message: "Maximum leeftijd moet ≥ minimum zijn" },
);
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

export const setProgramVisibilitySchema = z.object({
  tenant_id: Uuid,
  id: Uuid,
  visibility: z.enum(VISIBILITY_VALUES),
});
export type SetProgramVisibilityInput = z.infer<typeof setProgramVisibilitySchema>;

export const linkProgramGroupSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  group_id: Uuid,
  is_primary: z.boolean().default(false),
});
export type LinkProgramGroupInput = z.infer<typeof linkProgramGroupSchema>;

export const unlinkProgramGroupSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  group_id: Uuid,
});
export type UnlinkProgramGroupInput = z.infer<typeof unlinkProgramGroupSchema>;

export const setPrimaryProgramGroupSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  group_id: Uuid,
});
export type SetPrimaryProgramGroupInput = z.infer<typeof setPrimaryProgramGroupSchema>;
