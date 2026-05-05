import { z } from "zod";
import { INVITE_TYPES } from "@/lib/actions/tenant/invite-statuses";
import { MEMBER_ROLES, MEMBER_STATUSES } from "./members";

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
    // Sprint D: voor invite-mode is `full_name` optioneel; voor manual/
    // minor checken we het in superRefine.
    full_name: z.string().trim().max(120).optional().or(z.literal("")),
    first_name: z.string().trim().max(80).optional().or(z.literal("")),
    last_name: z.string().trim().max(80).optional().or(z.literal("")),
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
    /** Sprint D: optional admin-step overrides. */
    member_status: z.enum(MEMBER_STATUSES).optional(),
    member_since: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Gebruik formaat YYYY-MM-DD")
      .optional()
      .or(z.literal("")),
    internal_notes: z.string().trim().max(2000).optional().or(z.literal("")),
    assign_membership_plan_id: z.string().uuid().optional().or(z.literal("")),
    /** Sprint D: minor flow — create a brand-new parent without an invite. */
    new_parent_full_name: z.string().trim().min(2).max(120).optional().or(z.literal("")),
    new_parent_email: z
      .string()
      .trim()
      .max(200)
      .email("Ongeldig e-mailadres")
      .optional()
      .or(z.literal("")),
    new_parent_phone: optionalText,
  })
  .superRefine((v, ctx) => {
    // Naam-vereisten per modus.
    const nameLen = (v.full_name ?? "").trim().length;
    if (v.mode !== "invite" && nameLen < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["full_name"],
        message: "Naam is verplicht.",
      });
    }
    // Sprint D: trainer/staff invites moeten altijd via e-mail —
    // 'manual' (zonder uitnodiging) is niet toegestaan voor deze types.
    if (
      v.mode === "manual" &&
      (v.invite_type === "trainer_account" || v.invite_type === "staff_account")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mode"],
        message:
          "Trainer/staf-leden moeten altijd via uitnodiging worden aangemaakt.",
      });
    }
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
      // One of three: existing parent, parent invite by email, OR
      // create a brand-new parent (manual, no invite).
      const hasNewParent = Boolean(v.new_parent_full_name);
      if (!v.parent_member_id && !v.parent_email && !hasNewParent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parent_email"],
          message:
            "Kies een bestaande ouder, vul een ouder e-mailadres in, of maak een nieuwe ouder aan.",
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
