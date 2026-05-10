import { z } from "zod";

const Uuid = z.string().uuid();

export const PROGRAM_INSTRUCTOR_ASSIGNMENT = ["primary", "assistant"] as const;
export type ProgramInstructorAssignment = (typeof PROGRAM_INSTRUCTOR_ASSIGNMENT)[number];

export const addProgramInstructorSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  member_id: Uuid,
  assignment_type: z.enum(PROGRAM_INSTRUCTOR_ASSIGNMENT).default("primary"),
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type AddProgramInstructorInput = z.infer<typeof addProgramInstructorSchema>;

export const removeProgramInstructorSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  member_id: Uuid,
});
export type RemoveProgramInstructorInput = z.infer<typeof removeProgramInstructorSchema>;

export const updateProgramInstructorAssignmentSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  member_id: Uuid,
  assignment_type: z.enum(PROGRAM_INSTRUCTOR_ASSIGNMENT),
});
export type UpdateProgramInstructorAssignmentInput = z.infer<
  typeof updateProgramInstructorAssignmentSchema
>;

const NullableNote = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const NullablePositiveInt = z
  .union([z.number().int(), z.string()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Moet positief geheel getal zijn")
  .nullable()
  .default(null);

export const addProgramResourceSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  resource_id: Uuid,
  max_participants: NullablePositiveInt,
  notes: NullableNote,
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type AddProgramResourceInput = z.infer<typeof addProgramResourceSchema>;

export const removeProgramResourceSchema = z.object({
  tenant_id: Uuid,
  program_id: Uuid,
  resource_id: Uuid,
});
export type RemoveProgramResourceInput = z.infer<typeof removeProgramResourceSchema>;
