import { z } from "zod";

/**
 * Validatie voor het kennismakingsformulier op de marketingsite.
 * Berichten in het Nederlands omdat het formulier publiek is.
 */
export const intakeRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Vul je volledige naam in.")
    .max(120, "Naam is te lang."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Vul een geldig e-mailadres in."),
  organisation: z
    .string()
    .trim()
    .min(2, "Vul de naam van jouw organisatie in.")
    .max(160, "Organisatienaam is te lang."),
  role: z
    .string()
    .trim()
    .max(120, "Functie is te lang.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  sector: z
    .enum([
      "sportvereniging",
      "zwemschool",
      "sportschool",
      "academie",
      "dansschool",
      "vechtsport",
      "anders",
    ])
    .default("anders"),
  members: z
    .enum(["<50", "50-200", "200-500", "500-1000", "1000+"])
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  preferred_contact: z.enum(["email", "telefoon", "video"]).default("email"),
  phone: z
    .string()
    .trim()
    .max(40, "Telefoonnummer is te lang.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  message: z
    .string()
    .trim()
    .max(2000, "Bericht is te lang.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Ga akkoord met onze privacyvoorwaarden." }),
  }),
  // Honeypot — moet leeg blijven; bots vullen dit vaak in.
  website: z.string().max(0, "Spam gedetecteerd.").optional().default(""),
});

export type IntakeRequestInput = z.infer<typeof intakeRequestSchema>;
