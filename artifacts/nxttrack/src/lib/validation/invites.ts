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

export const acceptAdultInviteSchema = z
  .object({
    token: z.string().min(8).max(200),
    password: z
      .string()
      .min(8, "Minimaal 8 tekens.")
      .max(72, "Maximaal 72 tekens."),
    full_name: z.string().trim().min(2, "Naam is verplicht").max(120),
  });

export type AcceptAdultInviteInput = z.infer<typeof acceptAdultInviteSchema>;

export const acceptMinorLinkSchema = z.object({
  token: z.string().min(8).max(200),
});
export type AcceptMinorLinkInput = z.infer<typeof acceptMinorLinkSchema>;

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
