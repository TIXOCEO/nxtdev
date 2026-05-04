import { z } from "zod";

export const BILLING_PERIODS = ["monthly", "quarterly", "yearly", "custom"] as const;

export const createMembershipPlanSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().trim().min(2, "Naam is verplicht").max(120),
  price: z
    .union([z.number(), z.string()])
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (!Number.isNaN(v) && v >= 0), "Ongeldige prijs")
    .nullable()
    .default(null),
  billing_period: z.enum(BILLING_PERIODS).default("monthly"),
  is_active: z.boolean().default(true),
});

export type CreateMembershipPlanInput = z.infer<typeof createMembershipPlanSchema>;
