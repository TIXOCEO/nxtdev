import { z } from "zod";
import { strongPasswordSchema } from "./password";
import { slugify } from "@/lib/utils/slug";

// Auto-normaliseert: lower-case, spaties → "-", diacritics weg, ongeldige
// tekens weg. Daarna pas validatie op lengte en patroon.
const slugSchema = z
  .string()
  .transform((v) => slugify(v))
  .pipe(
    z
      .string()
      .min(3, "Slug moet minstens 3 tekens lang zijn")
      .max(63, "Slug is te lang")
      .regex(
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
        "Slug mag alleen kleine letters, cijfers en streepjes bevatten",
      ),
  );

const statusSchema = z.enum(["active", "inactive"]);

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #b6d83b");

const optionalEmail = z
  .string()
  .trim()
  .email("Invalid email")
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalUrl = z
  .string()
  .trim()
  .url("Invalid URL")
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalText = z
  .string()
  .trim()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

/**
 * Custom domein voor een tenant (bv. "voetbalschool-houtrust.nl").
 * Accepteert lowercase hostnames met punten en streepjes, geen protocol,
 * geen pad, geen poort. Wordt automatisch genormaliseerd.
 */
const HOSTNAME_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const PLATFORM_APEX = (process.env.APEX_DOMAIN || "nxttrack.nl").toLowerCase();
const optionalDomain = z
  .string()
  .trim()
  .toLowerCase()
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim() : null))
  .refine(
    (v) => v === null || HOSTNAME_RE.test(v),
    "Ongeldig domein. Gebruik formaat zoals 'voorbeeld.nl' (zonder https:// of pad).",
  )
  .refine(
    (v) =>
      v === null ||
      (v !== PLATFORM_APEX &&
        v !== `www.${PLATFORM_APEX}` &&
        !v.endsWith(`.${PLATFORM_APEX}`)),
    `Subdomeinen van ${PLATFORM_APEX} kunnen niet als custom domein. Gebruik de tenant-slug.`,
  );

export const createTenantSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  slug: slugSchema,
  logo_url: optionalUrl,
  primary_color: colorSchema.default("#b6d83b"),
  contact_email: optionalEmail,
  domain: optionalDomain,
  status: statusSchema.default("active"),
});

export const updateTenantSchema = createTenantSchema.partial().extend({
  id: z.string().uuid("Invalid tenant id"),
});

export const setTenantStatusSchema = z.object({
  id: z.string().uuid("Invalid tenant id"),
  status: statusSchema,
});

export const createTenantAdminSchema = z.object({
  tenant_id: z.string().uuid("Invalid tenant id"),
  email: z.string().trim().toLowerCase().email("Invalid email"),
  full_name: z.string().trim().min(1).max(120).optional(),
});

/**
 * Used when the platform admin creates a tenant: the tenant fields PLUS
 * the master admin's auth credentials. The master admin gets an
 * `auth.users` row + a `tenant_admin` membership in one server action.
 */
export const createTenantWithAdminSchema = createTenantSchema.extend({
  admin_email: z.string().trim().toLowerCase().email("Invalid email"),
  admin_password: strongPasswordSchema,
  admin_full_name: z.string().trim().min(1).max(120).optional().or(z.literal("")),
});

/**
 * Used when the platform admin updates the tenant master admin's
 * credentials. Both fields are optional; at least one must be provided.
 */
export const updateMasterAdminSchema = z
  .object({
    tenant_id: z.string().uuid("Invalid tenant id"),
    email: z.string().trim().toLowerCase().email("Invalid email").optional().or(z.literal("")),
    password: strongPasswordSchema.optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    const hasEmail = typeof val.email === "string" && val.email.length > 0;
    const hasPassword = typeof val.password === "string" && val.password.length > 0;
    if (!hasEmail && !hasPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Provide a new email and/or password.",
      });
    }
  });

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type SetTenantStatusInput = z.infer<typeof setTenantStatusSchema>;
export type CreateTenantAdminInput = z.infer<typeof createTenantAdminSchema>;
export type CreateTenantWithAdminInput = z.infer<typeof createTenantWithAdminSchema>;
export type UpdateMasterAdminInput = z.infer<typeof updateMasterAdminSchema>;
