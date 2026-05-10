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

// ──────────────────────────────────────────────────────────────────
// Sprint 23 / Sprint C — Publieke onboarding-wizard
// ──────────────────────────────────────────────────────────────────

export function computeAgeYears(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export const PUBLIC_ACCOUNT_TYPES = [
  "parent",
  "adult_athlete",
  "trainer",
  "staff",
] as const;
export type PublicAccountType = (typeof PUBLIC_ACCOUNT_TYPES)[number];

const firstName = z
  .string()
  .trim()
  .min(1, "Voornaam is verplicht")
  .max(80, "Maximaal 80 tekens");
const lastName = z
  .string()
  .trim()
  .min(1, "Achternaam is verplicht")
  .max(120, "Maximaal 120 tekens");

const koppelCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{4,32}$/, "Vul een geldige koppelcode in");

export const publicChildEntrySchema = z
  .object({
    mode: z.enum(["new", "link"]),
    first_name: z.string().optional().default(""),
    last_name: z.string().optional().default(""),
    birth_date: z.string().optional().default(""),
    player_type: z
      .union([z.enum(["player", "goalkeeper"]), z.literal("")])
      .optional(),
    koppel_code: z.string().optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "new") {
      const fn = firstName.safeParse(v.first_name);
      if (!fn.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["first_name"],
          message: fn.error.issues[0]?.message ?? "Voornaam is verplicht",
        });
      }
      const ln = lastName.safeParse(v.last_name);
      if (!ln.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["last_name"],
          message: ln.error.issues[0]?.message ?? "Achternaam is verplicht",
        });
      }
      const dob = isoDate.safeParse(v.birth_date);
      if (!dob.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["birth_date"],
          message: "Geboortedatum is verplicht",
        });
      }
      if (v.player_type !== "player" && v.player_type !== "goalkeeper") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["player_type"],
          message: "Maak een keuze",
        });
      }
    } else {
      const cc = koppelCode.safeParse(v.koppel_code ?? "");
      if (!cc.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["koppel_code"],
          message: cc.error.issues[0]?.message ?? "Vul een geldige koppelcode in",
        });
      }
    }
  });

export type PublicChildEntryInput = z.infer<typeof publicChildEntrySchema>;

export const publicOnboardingSchema = z
  .object({
    tenant_slug: tenantSlug,
    account_type: z.enum(PUBLIC_ACCOUNT_TYPES, { message: "Maak een keuze" }),
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    // Adult-athlete only — loose at object level, validated below.
    birth_date: z.string().optional().default(""),
    player_type: z
      .union([z.enum(["player", "goalkeeper"]), z.literal("")])
      .optional(),
    // Parent only.
    children: z.array(publicChildEntrySchema).default([]),
    extra_details: extraDetails,
    agreed_terms: agreedTerms,
    // Sprint 63 — optionele program-deeplink. Als gezet wordt het
    // gekozen programma als intentie op de nieuwe member opgeslagen
    // (kinderen erven hetzelfde programma). Server-laag valideert
    // tenant + visibility=public; defense-in-depth in RPC.
    program_id: z
      .union([z.string().uuid(), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v !== "" ? v : null)),
  })
  .superRefine((v, ctx) => {
    if (v.account_type === "adult_athlete") {
      const dob = isoDate.safeParse(v.birth_date);
      if (!dob.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["birth_date"],
          message: "Geboortedatum is verplicht",
        });
      } else {
        const age = computeAgeYears(v.birth_date);
        if (age !== null && age < 18) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["birth_date"],
            message:
              "Je bent jonger dan 18 — kies 'Ouder/verzorger' en laat een ouder de aanmelding voltooien.",
          });
        }
      }
      if (v.player_type !== "player" && v.player_type !== "goalkeeper") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["player_type"],
          message: "Maak een keuze",
        });
      }
    }
    if (v.account_type === "parent") {
      if (!v.children || v.children.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["children"],
          message: "Voeg minimaal één kind toe",
        });
      }
    }
  });

export type PublicOnboardingInput = z.infer<typeof publicOnboardingSchema>;
