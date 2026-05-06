import { z } from "zod";

export const RELEASE_TYPES = ["major", "minor", "patch"] as const;
export const RELEASE_STATUSES = ["draft", "published", "archived"] as const;

export type ReleaseType = (typeof RELEASE_TYPES)[number];
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const bulletList = z
  .array(z.string().trim().min(1, "Bullet mag niet leeg zijn").max(500))
  .max(20, "Maximaal 20 bullets per sectie")
  .default([]);

export const releaseBodySchema = z.object({
  new: bulletList,
  improved: bulletList,
  fixed: bulletList,
  admin: bulletList,
});

export type ReleaseBody = z.infer<typeof releaseBodySchema>;

const baseFields = {
  version: z
    .string()
    .trim()
    .regex(SEMVER_RE, "Gebruik semver-formaat zoals 0.9.0"),
  release_type: z.enum(RELEASE_TYPES),
  title: z.string().trim().min(2, "Titel is verplicht").max(160),
  summary: z
    .string()
    .trim()
    .min(2, "Samenvatting is verplicht")
    .max(400, "Samenvatting is max 400 tekens"),
  body: releaseBodySchema,
  status: z.enum(RELEASE_STATUSES).default("draft"),
  published_at: z
    .string()
    .trim()
    .min(1, "Publicatiedatum is verplicht")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Ongeldige datum"),
};

export const createReleaseSchema = z.object(baseFields);

export const updateReleaseSchema = z.object({
  id: z.string().uuid(),
  ...baseFields,
});

export const setReleaseStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(RELEASE_STATUSES),
});

export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;
export type UpdateReleaseInput = z.infer<typeof updateReleaseSchema>;
export type SetReleaseStatusInput = z.infer<typeof setReleaseStatusSchema>;
