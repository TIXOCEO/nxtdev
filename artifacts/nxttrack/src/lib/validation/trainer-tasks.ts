import { z } from "zod";

export const TRAINER_TASK_STATUSES = ["open", "done", "cancelled"] as const;
export const TRAINER_TASK_PRIORITIES = ["low", "normal", "high"] as const;

export const createTrainerTaskSchema = z.object({
  assigned_to_user_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional().nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  priority: z.enum(TRAINER_TASK_PRIORITIES).default("normal"),
});

export const updateTrainerTaskSchema = createTrainerTaskSchema.partial().extend({
  id: z.string().uuid(),
  status: z.enum(TRAINER_TASK_STATUSES).optional(),
});

export type CreateTrainerTaskInput = z.infer<typeof createTrainerTaskSchema>;
export type UpdateTrainerTaskInput = z.infer<typeof updateTrainerTaskSchema>;
