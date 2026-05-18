/**
 * Sprint 65 — Dynamic intake foundation.
 *
 * Gedeelde typen voor de intake-laag. De DB-tabellen worden hier
 * gespiegeld als TypeScript-typen zodat zowel server-action,
 * resolver, schema-builder, sector-defaults en renderer dezelfde
 * shape gebruiken.
 */

export type IntakeFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "date"
  | "number"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "consent";

export type IntakeSubmissionType =
  | "registration"
  | "trial_lesson"
  | "waitlist_request"
  | "information_request";

/**
 * Sprint 73 — Uitgebreide lifecycle:
 *   submitted   = nieuw, nog niet aangeraakt
 *   in_review   = admin heeft actie genomen, beoordeling loopt
 *   needs_review= automatisch geflagged (medisch / leeftijd / onbekend)
 *   waitlisted  = op de wachtlijst gezet
 *   placed      = toegewezen aan een groep (zie placements.ts)
 *   rejected    = afgewezen
 *   converted   = omgezet naar registration/member (Sprint 74+)
 */
export type IntakeSubmissionStatus =
  | "submitted"
  | "in_review"
  | "needs_review"
  | "waitlisted"
  | "placed"
  | "rejected"
  | "converted";

export type IntakeRegistrationTarget = "self" | "child";

/**
 * Single-clause show-if. Ondersteunt `equals`, `not_equals` of `in`
 * op één veld. Backwards compatible: oude rows met alleen `equals`
 * blijven werken (Sprint 82).
 */
export interface IntakeShowIf {
  field_key: string;
  equals?: string | number | boolean;
  not_equals?: string | number | boolean;
  in?: Array<string | number | boolean>;
}

export interface IntakeFieldOption {
  value: string;
  label: string;
}

export interface IntakeFieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  maxLength?: number;
}

export interface IntakeFormFieldConfig {
  /** Stabiele machine-key. Uniek per form. */
  key: string;
  label: string;
  help_text?: string | null;
  field_type: IntakeFieldType;
  is_required?: boolean;
  options?: IntakeFieldOption[];
  validation?: IntakeFieldValidation;
  show_if?: IntakeShowIf | null;
  sort_order?: number;
  pii_class?: "standard" | "sensitive";
  /**
   * Optioneel: mapping naar gedenormaliseerde kolommen op
   * `intake_submissions` (contact_name / contact_email /
   * contact_phone / contact_date_of_birth / registration_target).
   */
  canonical_target?:
    | "contact_name"
    | "contact_email"
    | "contact_phone"
    | "contact_date_of_birth"
    | "registration_target"
    | "preferred_level"
    | null;
}

export interface IntakeFormConfig {
  /**
   * Stabiele identifier. Voor DB-forms is dit het uuid; voor
   * code-side sector-defaults een synthetische slug-prefix met
   * `default:`.
   */
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status: "draft" | "published" | "archived";
  is_default?: boolean;
  submission_type: IntakeSubmissionType;
  /** ISO-timestamp voor cache-keying. */
  updated_at: string;
  fields: IntakeFormFieldConfig[];
  /**
   * Bron van het formulier — `db` wanneer geladen uit
   * `intake_forms`-tabel, `sector-default` wanneer fallback.
   */
  source: "db" | "sector-default";
}

export interface IntakeSubmissionPayload {
  tenant_slug: string;
  /** Optionele program-deeplink (`?program=<public_slug>` op /proefles). */
  program_public_slug?: string | null;
  submission_type: IntakeSubmissionType;
  form_slug?: string | null;
  answers: Record<string, unknown>;
}
