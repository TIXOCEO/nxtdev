import { z } from "zod";

const Uuid = z.string().uuid();

const HexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Kleur moet een #rrggbb hex zijn")
  .nullable()
  .optional()
  .transform((v) => (v == null || v === "" ? null : v.toLowerCase()));

const StageName = z
  .string()
  .trim()
  .min(1, "Naam is verplicht")
  .max(64, "Naam is te lang (max 64)");

const NullableShortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : v));

export const createProgramStageSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  name: StageName,
  description: NullableShortText(500),
  color: HexColor,
  sort_order: z
    .union([z.number().int(), z.string()])
    .transform((v) => (v === "" || v === null || v === undefined ? 0 : Number(v)))
    .refine((v) => Number.isInteger(v) && v >= 0, "Moet 0 of meer zijn")
    .default(0),
});
export type CreateProgramStageInput = z.infer<typeof createProgramStageSchema>;

export const updateProgramStageSchema = z.object({
  tenant_id: Uuid,
  stage_id: Uuid,
  name: StageName.optional(),
  description: NullableShortText(500),
  color: HexColor,
  sort_order: z
    .union([z.number().int(), z.string()])
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0), "Moet 0 of meer zijn")
    .nullable()
    .optional(),
});
export type UpdateProgramStageInput = z.infer<typeof updateProgramStageSchema>;

export const archiveProgramStageSchema = z.object({
  tenant_id: Uuid,
  stage_id: Uuid,
  archived: z.boolean(),
});
export type ArchiveProgramStageInput = z.infer<typeof archiveProgramStageSchema>;

export const setProgramUseStagesSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  use_stages: z.boolean(),
});
export type SetProgramUseStagesInput = z.infer<typeof setProgramUseStagesSchema>;

export const attachGroupStageSchema = z.object({
  tenant_id: Uuid,
  group_id: Uuid,
  stage_id: Uuid,
});
export type AttachGroupStageInput = z.infer<typeof attachGroupStageSchema>;

export const detachGroupStageSchema = attachGroupStageSchema;
export type DetachGroupStageInput = AttachGroupStageInput;

export const reorderProgramStagesSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  stage_ids: z.array(Uuid).min(1, "Minimaal één stage vereist"),
});
export type ReorderProgramStagesInput = z.infer<typeof reorderProgramStagesSchema>;
