import { z } from "zod";

export const PAYMENT_PERIODS = ["maand", "jaar", "anders"] as const;

const amountField = z
  .union([z.number(), z.string()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (!Number.isNaN(v) && v >= 0), "Ongeldig bedrag")
  .nullable();

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum")
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const noteOptional = z
  .string()
  .trim()
  .max(1000)
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const createPaymentSchema = z.object({
  tenant_id: z.string().uuid(),
  member_membership_id: z.string().uuid(),
  membership_plan_id: z.string().uuid().nullish().or(z.literal("")).transform((v) => (v ? v : null)),
  paid_via_payment_method_id: z
    .string()
    .uuid()
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  amount_expected: amountField.default(null),
  amount_paid: amountField.default(null),
  period: z.enum(PAYMENT_PERIODS).nullish().default(null),
  paid_at: dateField,
  due_date: dateField,
  parent_payment_id: z
    .string()
    .uuid()
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  note: noteOptional,
});

export type CreatePaymentInput = z.input<typeof createPaymentSchema>;

export const updatePaymentSchema = createPaymentSchema.extend({
  id: z.string().uuid(),
  // Wijzigen vereist een notitie als audit-spoor.
  audit_note: z.string().trim().min(3, "Notitie is verplicht").max(1000),
});

export type UpdatePaymentInput = z.input<typeof updatePaymentSchema>;

export const deletePaymentSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
  audit_note: z.string().trim().min(3, "Notitie is verplicht").max(1000),
});

export type DeletePaymentInput = z.input<typeof deletePaymentSchema>;

export const endMembershipSchema = z.object({
  tenant_id: z.string().uuid(),
  member_membership_id: z.string().uuid(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige einddatum"),
  end_reason: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export type EndMembershipInput = z.input<typeof endMembershipSchema>;

// Sprint 30 — er moet altijd precies één standaard zijn per type, dus
// `id` is verplicht: het is de nieuwe standaard. Wil de admin een ander
// item kiezen, dan komt er een nieuwe call met de nieuwe id binnen; we
// laten unsetten naar "niets" niet toe.
export const setDefaultPlanSchema = z.object({
  tenant_id: z.string().uuid(),
  id: z.string().uuid(),
});

export const setDefaultPaymentMethodSchema = setDefaultPlanSchema;

/**
 * Sprint 30 — afgeleide status uit (amount_paid, amount_expected).
 * - paid     : paid >= expected (>0)
 * - partial  : 0 < paid < expected
 * - due      : paid == 0 (of null) en expected > 0
 * Bij ontbrekende `expected` valt status terug op de meegegeven waarde of 'due'.
 */
export function deriveStatus(opts: {
  amount_paid: number | null;
  amount_expected: number | null;
  fallback?: string;
}): "paid" | "partial" | "due" {
  const paid = opts.amount_paid ?? 0;
  const expected = opts.amount_expected ?? 0;
  if (expected <= 0) {
    return paid > 0 ? "paid" : "due";
  }
  if (paid <= 0) return "due";
  if (paid >= expected) return "paid";
  return "partial";
}
