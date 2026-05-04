import { z } from "zod";

const isoDateTime = z
  .string()
  .min(1, "Datum/tijd is verplicht")
  .refine((s) => !Number.isNaN(Date.parse(s)), "Ongeldige datum/tijd");

export const ABSENCE_REASONS = [
  "ziekte",
  "blessure",
  "school",
  "werk",
  "vakantie",
  "geen_vervoer",
  "overig",
] as const;

const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

export const createTrainingSessionSchema = z
  .object({
    tenant_id: z.string().uuid(),
    group_id: z.string().uuid({ message: "Selecteer een groep" }),
    title: z.string().trim().min(2, "Titel is verplicht").max(160),
    description: optStr(2000),
    location: optStr(200),
    starts_at: isoDateTime,
    ends_at: isoDateTime,
  })
  .refine(
    (v) => Date.parse(v.ends_at) > Date.parse(v.starts_at),
    { message: "Eindtijd moet na starttijd liggen", path: ["ends_at"] },
  );

export type CreateTrainingSessionInput = z.infer<typeof createTrainingSessionSchema>;

export const updateTrainingStatusSchema = z.object({
  tenant_id: z.string().uuid(),
  session_id: z.string().uuid(),
  status: z.enum(["scheduled", "cancelled", "completed"]),
});
export type UpdateTrainingStatusInput = z.infer<typeof updateTrainingStatusSchema>;

export const setRsvpSchema = z.object({
  tenant_id: z.string().uuid(),
  session_id: z.string().uuid(),
  member_id: z.string().uuid(),
  rsvp: z.enum(["attending", "not_attending", "maybe"]),
  /** Sprint 13: required when rsvp = not_attending. */
  absence_reason: z.enum(ABSENCE_REASONS).nullish(),
  /** Sprint 13: free text shown when absence_reason = "overig". */
  attendance_reason: optStr(500),
  /** Caller acknowledges this is a late update (past the cutoff). */
  confirm_late: z.boolean().optional(),
});
export type SetRsvpInput = z.infer<typeof setRsvpSchema>;

export const setAttendanceSchema = z.object({
  tenant_id: z.string().uuid(),
  session_id: z.string().uuid(),
  member_id: z.string().uuid(),
  attendance: z.enum(["present", "absent", "late", "injured"]),
  notes: optStr(500),
  /** Sprint 13: trainer can see/override the absence reason. */
  absence_reason: z.enum(ABSENCE_REASONS).nullish(),
  /** Sprint 13: trainer-only private note. */
  trainer_note: optStr(1000),
});
export type SetAttendanceInput = z.infer<typeof setAttendanceSchema>;

export const trainingSettingsSchema = z.object({
  tenant_id: z.string().uuid(),
  reminder_hours_before: z.coerce.number().int().min(1).max(168),
  late_response_hours: z.coerce.number().int().min(0).max(168),
  notify_trainer_on_late: z.boolean(),
});
export type TrainingSettingsInput = z.infer<typeof trainingSettingsSchema>;
