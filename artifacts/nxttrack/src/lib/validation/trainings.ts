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
    /** Sprint 61: optionele program-koppeling. Bij gevulde program_id worden
     *  default-resources van het programma automatisch op de sessie gezet. */
    program_id: z.string().uuid().or(z.literal("")).nullish(),
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

export const NOTE_VISIBILITY = ["private", "member"] as const;
export type NoteVisibility = (typeof NOTE_VISIBILITY)[number];

export const setAttendanceSchema = z.object({
  tenant_id: z.string().uuid(),
  session_id: z.string().uuid(),
  member_id: z.string().uuid(),
  attendance: z.enum(["present", "absent", "late", "injured"]),
  /** Sprint 35 — single note + visibility (replaces notes + trainer_note). */
  note: optStr(1000),
  note_visibility: z.enum(NOTE_VISIBILITY).default("private"),
  /** Sprint 13: trainer can see/override the absence reason. */
  absence_reason: z.enum(ABSENCE_REASONS).nullish(),
});
export type SetAttendanceInput = z.infer<typeof setAttendanceSchema>;

/** Sprint 35 — minimal observation (LVS) input. */
export const createObservationSchema = z.object({
  tenant_id: z.string().uuid(),
  member_id: z.string().uuid(),
  session_id: z.string().uuid().nullish(),
  body: z.string().trim().min(2, "Notitie is verplicht").max(4000),
  visibility: z.enum(NOTE_VISIBILITY).default("private"),
});
export type CreateObservationInput = z.infer<typeof createObservationSchema>;

export const trainingSettingsSchema = z.object({
  tenant_id: z.string().uuid(),
  reminder_hours_before: z.coerce.number().int().min(1).max(168),
  late_response_hours: z.coerce.number().int().min(0).max(168),
  notify_trainer_on_late: z.boolean(),
});
export type TrainingSettingsInput = z.infer<typeof trainingSettingsSchema>;
