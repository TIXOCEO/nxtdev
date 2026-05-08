import { z } from "zod";

const Uuid = z.string().uuid();
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Ongeldig tijdstip (HH:MM)");

export const availabilitySchema = z
  .object({
    tenant_id: Uuid,
    member_id: Uuid,
    day_of_week: z.number().int().min(0).max(6),
    start_time: Time,
    end_time: Time,
    availability_type: z.enum(["available", "preferred", "unavailable"]).default("available"),
    valid_from: z.string().date().nullable().optional(),
    valid_until: z.string().date().nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => v.end_time > v.start_time, {
    message: "Eindtijd moet ná starttijd liggen",
    path: ["end_time"],
  });

export type AvailabilityInput = z.infer<typeof availabilitySchema>;

export const updateAvailabilitySchema = z
  .object({
    tenant_id: Uuid,
    id: Uuid,
    day_of_week: z.number().int().min(0).max(6),
    start_time: Time,
    end_time: Time,
    availability_type: z.enum(["available", "preferred", "unavailable"]).default("available"),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => v.end_time > v.start_time, {
    message: "Eindtijd moet ná starttijd liggen",
    path: ["end_time"],
  });
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;

export const unavailabilitySchema = z
  .object({
    tenant_id: Uuid,
    member_id: Uuid,
    starts_at: z.string().min(1),
    ends_at: z.string().min(1),
    reason: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => new Date(v.ends_at).getTime() > new Date(v.starts_at).getTime(), {
    message: "Eindtijd moet ná starttijd liggen",
    path: ["ends_at"],
  });

export type UnavailabilityInput = z.infer<typeof unavailabilitySchema>;

export const updateUnavailabilitySchema = z
  .object({
    tenant_id: Uuid,
    id: Uuid,
    starts_at: z.string().min(1),
    ends_at: z.string().min(1),
    reason: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => new Date(v.ends_at).getTime() > new Date(v.starts_at).getTime(), {
    message: "Eindtijd moet ná starttijd liggen",
    path: ["ends_at"],
  });
export type UpdateUnavailabilityInput = z.infer<typeof updateUnavailabilitySchema>;

export const sessionInstructorSchema = z
  .object({
    tenant_id: Uuid,
    session_id: Uuid,
    member_id: Uuid,
    assignment_type: z.enum(["primary", "assistant", "substitute", "observer"]).default("primary"),
    replaces_member_id: Uuid.nullable().optional(),
  })
  .refine(
    (v) => v.assignment_type === "substitute" || !v.replaces_member_id,
    { message: "replaces_member_id mag alleen bij assignment_type='substitute'", path: ["replaces_member_id"] },
  );

export type SessionInstructorInput = z.infer<typeof sessionInstructorSchema>;

export const updateGroupMinInstructorsSchema = z.object({
  tenant_id: Uuid,
  group_id: Uuid,
  default_min_instructors: z.number().int().min(0).max(50).nullable(),
});
export type UpdateGroupMinInstructorsInput = z.infer<typeof updateGroupMinInstructorsSchema>;

export const updateSessionMinInstructorsSchema = z.object({
  tenant_id: Uuid,
  session_id: Uuid,
  min_instructors: z.number().int().min(0).max(50).nullable(),
});
export type UpdateSessionMinInstructorsInput = z.infer<typeof updateSessionMinInstructorsSchema>;
