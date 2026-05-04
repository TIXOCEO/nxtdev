import { z } from "zod";

export const createAlertSchema = z.object({
  tenant_id: z.string().uuid(),
  title: z.string().trim().min(1, "Titel is verplicht").max(200),
  content: z.string().max(8000).nullable().optional(),
  type: z.enum(["alert", "announcement"]),
  is_active: z.boolean().default(true),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
});

export const updateAlertSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(8000).nullable().optional(),
  type: z.enum(["alert", "announcement"]).optional(),
  is_active: z.boolean().optional(),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
});
