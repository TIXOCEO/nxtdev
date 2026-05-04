import { z } from "zod";

// ──────────────────────────────────────────────────────────────────
// Shared primitives — Dutch error messages.
// ──────────────────────────────────────────────────────────────────

const tenantSlug = z
  .string()
  .min(1, "Ongeldige vereniging")
  .regex(/^[a-z0-9-]+$/, "Ongeldige vereniging");

const requiredString = (label: string, max = 200) =>
  z.string().trim().min(2, `${label} is verplicht`).max(max);

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "E-mail is verplicht")
  .email("Ongeldig e-mailadres")
  .max(160);

const phone = z.string().trim().min(4, "Telefoonnummer is verplicht").max(40);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Geboortedatum is verplicht")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1900;
  }, "Ongeldige geboortedatum");

const playerType = z.enum(["player", "goalkeeper"], {
  message: "Maak een keuze",
});

const target = z.enum(["self", "child"], { message: "Maak een keuze" });

const extraDetails = z
  .string()
  .trim()
  .max(1500, "Maximaal 1500 tekens")
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

const agreedTerms = z.literal(true, {
  message: "Je moet akkoord gaan met de voorwaarden",
});

const childAthlete = z.object({
  full_name: requiredString("Naam", 120),
  date_of_birth: isoDate,
  player_type: playerType,
});

// ──────────────────────────────────────────────────────────────────
// 1) Proefles (tryout) — single-person form.
//    Works for both self and child target.
// ──────────────────────────────────────────────────────────────────

export const publicTryoutSchema = z
  .object({
    tenant_slug: tenantSlug,
    registration_target: target,
    full_name: requiredString("Naam", 120),
    child_name: optionalText(120),
    email,
    phone,
    date_of_birth: isoDate,
    player_type: playerType,
    extra_details: extraDetails,
    agreed_terms: agreedTerms,
  })
  .superRefine((val, ctx) => {
    if (val.registration_target === "child") {
      const nameRes = z
        .string()
        .trim()
        .min(2, "Naam van het kind is verplicht")
        .max(120)
        .safeParse(val.child_name ?? "");
      if (!nameRes.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["child_name"],
          message:
            nameRes.error.issues[0]?.message ?? "Naam van het kind is verplicht",
        });
      }
    }
  });

export type PublicTryoutInput = z.infer<typeof publicTryoutSchema>;

// ──────────────────────────────────────────────────────────────────
// 2) Inschrijving (aspirant membership) — self or parent + 1..N kids.
// ──────────────────────────────────────────────────────────────────

// Loose athlete shape at the object level — actual per-field validation runs
// inside superRefine ONLY when registration_target === "child".  This avoids
// silently failing the form when hidden athlete rows hold their initial
// empty defaults during a self-registration.
const looseAthlete = z.object({
  full_name: z.string().optional().default(""),
  date_of_birth: z.string().optional().default(""),
  player_type: z.string().optional().default(""),
});

export const publicMembershipRegistrationSchema = z
  .object({
    tenant_slug: tenantSlug,
    registration_target: target,

    // Person filling in the form — used as the primary contact.
    full_name: requiredString("Naam", 120),
    address: requiredString("Adres", 200),
    postal_code: requiredString("Postcode", 20),
    city: requiredString("Plaats", 80),
    phone,
    email,
    extra_details: extraDetails,
    agreed_terms: agreedTerms,

    // Self-only fields — kept loose so that empty defaults don't fail the
    // child branch.  Strict validation happens in superRefine.
    date_of_birth: z.string().optional().default(""),
    player_type: z
      .union([playerType, z.literal(""), z.undefined()])
      .optional(),

    // Child-only — one or more athletes.  Loose at object-level; refined
    // per-field below ONLY when target === "child".
    athletes: z.array(looseAthlete).default([]),
  })
  .superRefine((val, ctx) => {
    if (val.registration_target === "self") {
      const dobRes = isoDate.safeParse(val.date_of_birth ?? "");
      if (!dobRes.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["date_of_birth"],
          message: "Geboortedatum is verplicht",
        });
      }
      const ptRes = playerType.safeParse(val.player_type);
      if (!ptRes.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["player_type"],
          message: "Maak een keuze",
        });
      }
      // For self-registrations, intentionally ignore any leftover athlete
      // rows from form defaults.
    } else {
      if (!val.athletes || val.athletes.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["athletes"],
          message: "Voeg minimaal één speler toe",
        });
      } else {
        val.athletes.forEach((a, idx) => {
          const nameRes = z
            .string()
            .trim()
            .min(2, "Naam is verplicht")
            .max(120)
            .safeParse(a.full_name);
          if (!nameRes.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["athletes", idx, "full_name"],
              message: nameRes.error.issues[0]?.message ?? "Naam is verplicht",
            });
          }
          const dobRes = isoDate.safeParse(a.date_of_birth);
          if (!dobRes.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["athletes", idx, "date_of_birth"],
              message: "Geboortedatum is verplicht",
            });
          }
          const ptRes = playerType.safeParse(a.player_type);
          if (!ptRes.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["athletes", idx, "player_type"],
              message: "Maak een keuze",
            });
          }
        });
      }
    }
  });

export type PublicMembershipRegistrationInput = z.infer<
  typeof publicMembershipRegistrationSchema
>;

// ──────────────────────────────────────────────────────────────────
// Legacy (sprint-6) schema — kept so the old /register redirect
// and existing tenant-admin types stay valid until we delete it.
// ──────────────────────────────────────────────────────────────────

export const publicRegistrationSchema = z.object({
  tenant_slug: tenantSlug,
  parent_name: requiredString("Naam", 120),
  parent_email: email,
  parent_phone: optionalText(40),
  child_name: requiredString("Naam kind", 120),
  child_age: z
    .union([z.coerce.number().int().min(2).max(99), z.literal("")])
    .nullish()
    .transform((v) => (typeof v === "number" ? v : null)),
  message: optionalText(1000),
});

export type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;
