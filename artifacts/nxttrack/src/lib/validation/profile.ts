import { z } from "zod";
import { isValidIban } from "@/lib/iban";

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .email("Ongeldig e-mailadres")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const dateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum moet YYYY-MM-DD zijn.")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const updateProfileGeneralSchema = z.object({
  tenant_id: z.string().uuid(),
  member_id: z.string().uuid(),
  first_name: z.string().trim().min(1, "Voornaam is verplicht.").max(80),
  last_name: z.string().trim().min(1, "Achternaam is verplicht.").max(80),
  phone: optionalText(40),
  birth_date: dateOrNull,
  gender: z.enum(["male", "female", "other"]).optional().or(z.literal("")),
  street: optionalText(120),
  house_number: optionalText(20),
  postal_code: optionalText(20),
  city: optionalText(120),
});

export const updateProfileSportSchema = z.object({
  tenant_id: z.string().uuid(),
  member_id: z.string().uuid(),
  player_type: z.enum(["player", "goalkeeper"]).optional().or(z.literal("")),
});

export const updateFinancialDetailsSchema = z
  .object({
    tenant_id: z.string().uuid(),
    member_id: z.string().uuid(),
    iban: z
      .string()
      .trim()
      .max(40)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v.replace(/\s+/g, "").toUpperCase() : "")),
    account_holder_name: optionalText(120),
    payment_method_id: z.string().uuid().optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.iban && !isValidIban(v.iban)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["iban"],
        message: "Ongeldig IBAN nummer (mod-97 check faalt).",
      });
    }
  });

export const addChildAsParentSchema = z.object({
  tenant_id: z.string().uuid(),
  parent_member_id: z.string().uuid(),
  first_name: z.string().trim().min(1, "Voornaam is verplicht.").max(80),
  last_name: z.string().trim().min(1, "Achternaam is verplicht.").max(80),
  birth_date: dateOrNull,
  gender: z.enum(["male", "female", "other"]).optional().or(z.literal("")),
  player_type: z.enum(["player", "goalkeeper"]).optional().or(z.literal("")),
});

export const revealIbanSchema = z.object({
  tenant_id: z.string().uuid(),
  member_id: z.string().uuid(),
});

export type UpdateProfileGeneralInput = z.infer<typeof updateProfileGeneralSchema>;
export type UpdateProfileSportInput = z.infer<typeof updateProfileSportSchema>;
export type UpdateFinancialDetailsInput = z.infer<
  typeof updateFinancialDetailsSchema
>;
export type AddChildAsParentInput = z.infer<typeof addChildAsParentSchema>;
export type RevealIbanInput = z.infer<typeof revealIbanSchema>;
