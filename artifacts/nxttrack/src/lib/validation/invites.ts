import { z } from "zod";
import { INVITE_TYPES } from "@/lib/actions/tenant/invite-statuses";
import { MEMBER_ROLES } from "./members";

const optionalText = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

/**
 * Sprint 10: create a member + dispatch an invite in one go.
 *
 * Mode:
 *  - "manual"   — just create the member (no invite email).
 *  - "invite"   — create the member AND dispatch an invite.
 *  - "minor"    — create a minor (athlete) member; if `parent_member_id`
 *                 is set, link to existing parent. If `parent_email` is
 *                 set instead, also dispatch a `minor_parent_link` invite
 *                 to that parent address.
 */
export const newMemberWithInviteSchema = z
  .object({
    tenant_id: z.string().uuid(),
    mode: z.enum(["manual", "invite", "minor"]),
    invite_type: z.enum(INVITE_TYPES).optional(),
    full_name: z.string().trim().min(2, "Naam is verplicht").max(120),
    email: z
      .string()
      .trim()
      .max(200)
      .email("Ongeldig e-mailadres")
      .nullish()
      .or(z.literal("")),
    phone: optionalText,
    roles: z.array(z.enum(MEMBER_ROLES)).default([]),
    // minor-only fields
    parent_member_id: z.string().uuid().optional().or(z.literal("")),
    parent_email: z
      .string()
      .trim()
      .max(200)
      .email("Ongeldig e-mailadres")
      .optional()
      .or(z.literal("")),
    /** Optional explicit duplicate-override flag from the UI. */
    confirm_duplicate: z.boolean().optional().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "invite") {
      if (!v.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "E-mail is verplicht voor uitnodigingen.",
        });
      }
      if (!v.invite_type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["invite_type"],
          message: "Kies een uitnodigingstype.",
        });
      }
    }
    if (v.mode === "minor") {
      // Need at least the minor's full_name (already required above).
      // Either link to existing parent OR send invite to parent email.
      if (!v.parent_member_id && !v.parent_email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parent_email"],
          message: "Geef een bestaande ouder of een ouderlijk e-mailadres.",
        });
      }
    }
  });

export type NewMemberWithInviteInput = z.infer<typeof newMemberWithInviteSchema>;

export const inviteIdSchema = z.object({
  tenant_id: z.string().uuid(),
  invite_id: z.string().uuid(),
});

// Strong-password rules — duplicated minimaal hier omdat we anders een
// nieuw lib-bestand zouden importeren in een schema dat ook door Edge/
// client gebruikt wordt. In sync houden met `src/lib/validation/password.ts`.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

export const acceptAdultInviteSchema = z
  .object({
    token: z.string().min(8).max(200),
    password: z
      .string()
      .min(PASSWORD_MIN, `Minimaal ${PASSWORD_MIN} tekens.`)
      .max(PASSWORD_MAX, `Maximaal ${PASSWORD_MAX} tekens.`)
      .refine((v) => /[a-z]/.test(v), "Voeg een kleine letter toe.")
      .refine((v) => /[A-Z]/.test(v), "Voeg een hoofdletter toe.")
      .refine((v) => /[0-9]/.test(v), "Voeg een cijfer toe.")
      .refine(
        (v) => /[^A-Za-z0-9]/.test(v),
        "Voeg een speciaal teken toe (bv. !, @, #).",
      ),
    password_confirm: z.string().min(1, "Bevestig je wachtwoord."),
    full_name: z.string().trim().min(2, "Naam is verplicht").max(120),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.password_confirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password_confirm"],
        message: "Wachtwoorden komen niet overeen.",
      });
    }
  });

export type AcceptAdultInviteInput = z.infer<typeof acceptAdultInviteSchema>;

export const acceptMinorLinkSchema = z.object({
  token: z.string().min(8).max(200),
});
export type AcceptMinorLinkInput = z.infer<typeof acceptMinorLinkSchema>;

/**
 * Sprint 23 (B) — Combineer parent-account-creatie + auto-link
 * voor `minor_parent_link` invites die een `child_member_id` dragen.
 *
 * Form-shape spiegelt {@link acceptAdultInviteSchema} bewust: de
 * eindgebruiker doorloopt exact dezelfde naam+wachtwoord-stap.
 */
export const acceptMinorParentSchema = z
  .object({
    token: z.string().min(8).max(200),
    password: z
      .string()
      .min(PASSWORD_MIN, `Minimaal ${PASSWORD_MIN} tekens.`)
      .max(PASSWORD_MAX, `Maximaal ${PASSWORD_MAX} tekens.`)
      .refine((v) => /[a-z]/.test(v), "Voeg een kleine letter toe.")
      .refine((v) => /[A-Z]/.test(v), "Voeg een hoofdletter toe.")
      .refine((v) => /[0-9]/.test(v), "Voeg een cijfer toe.")
      .refine(
        (v) => /[^A-Za-z0-9]/.test(v),
        "Voeg een speciaal teken toe (bv. !, @, #).",
      ),
    password_confirm: z.string().min(1, "Bevestig je wachtwoord."),
    full_name: z.string().trim().min(2, "Naam is verplicht").max(120),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.password_confirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password_confirm"],
        message: "Wachtwoorden komen niet overeen.",
      });
    }
  });

export type AcceptMinorParentInput = z.infer<typeof acceptMinorParentSchema>;

export const linkMinorByCodeSchema = z.object({
  tenant_id: z.string().uuid(),
  invite_code: z
    .string()
    .trim()
    .min(4, "Code is verplicht.")
    .max(32),
});
export type LinkMinorByCodeInput = z.infer<typeof linkMinorByCodeSchema>;

export const convertRegistrationSchema = z.object({
  tenant_id: z.string().uuid(),
  registration_id: z.string().uuid(),
  send_invite: z.boolean().default(true),
});
export type ConvertRegistrationInput = z.infer<typeof convertRegistrationSchema>;

export const generateMinorCodeSchema = z.object({
  tenant_id: z.string().uuid(),
  parent_member_id: z.string().uuid(),
  child_member_id: z.string().uuid(),
});
export type GenerateMinorCodeInput = z.infer<typeof generateMinorCodeSchema>;
