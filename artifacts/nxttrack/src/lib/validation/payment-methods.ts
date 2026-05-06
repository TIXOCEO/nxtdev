import { z } from "zod";
import { isValidIban, normalizeIban } from "@/lib/iban";

export const PAYMENT_METHOD_TYPES = [
  "contant",
  "rekening",
  "incasso",
  "overig",
] as const;

const optionalIban = z
  .string()
  .trim()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? normalizeIban(v) : null))
  .refine((v) => v === null || isValidIban(v), {
    message: "Ongeldig IBAN",
  });

const optionalText = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const sortOrderField = z
  .union([z.number(), z.string()])
  .transform((v) => (v === "" || v === null || v === undefined ? 0 : Number(v)))
  .refine((v) => !Number.isNaN(v) && Number.isFinite(v), "Ongeldige volgorde")
  .default(0);

function withIbanRule<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((v: { type: string; iban_for_rekening: string | null }, ctx) => {
    if (v.type === "rekening" && (v.iban_for_rekening === null || v.iban_for_rekening.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "IBAN is verplicht voor type 'rekening'",
        path: ["iban_for_rekening"],
      });
    }
  });
}

export const createPaymentMethodSchema = withIbanRule(
  z.object({
    tenant_id: z.string().uuid(),
    name: z.string().trim().min(1, "Naam is verplicht").max(120),
    type: z.enum(PAYMENT_METHOD_TYPES),
    description: optionalText,
    iban_for_rekening: optionalIban,
    sort_order: sortOrderField,
  }),
);

export const updatePaymentMethodSchema = withIbanRule(
  z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    name: z.string().trim().min(1, "Naam is verplicht").max(120),
    type: z.enum(PAYMENT_METHOD_TYPES),
    description: optionalText,
    iban_for_rekening: optionalIban,
    sort_order: sortOrderField,
  }),
);

// Use input types so that callers can still pass `sort_order: string`
// (the zod transform converts it to a number before the action body runs).
export type CreatePaymentMethodInput = z.input<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.input<typeof updatePaymentMethodSchema>;
