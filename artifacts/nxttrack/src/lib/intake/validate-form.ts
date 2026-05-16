import type { IntakeFormFieldConfig } from "./types";

/**
 * Sprint 66 — TypeScript-mirror van `validate_intake_form(uuid)` SQL-RPC.
 *
 * Gebruikt in de builder voor client-side preview vóór publish. De
 * server-trigger (DB) is de echte gatekeeper; dit is alleen UX.
 *
 * Houd de error-codes 1-op-1 in sync met de SQL-RPC.
 */

export interface IntakeFormValidationError {
  code:
    | "no_fields"
    | "missing_options"
    | "invalid_pattern"
    | "invalid_canonical_target"
    | "show_if_empty_target"
    | "show_if_missing_target"
    | "show_if_self_reference"
    | "show_if_cycle";
  field_key?: string;
  target_key?: string;
  message: string;
}

export interface IntakeFormValidationResult {
  is_valid: boolean;
  errors: IntakeFormValidationError[];
}

const TYPES_WITH_OPTIONS: ReadonlyArray<IntakeFormFieldConfig["field_type"]> = [
  "select",
  "multiselect",
  "radio",
];

const ALLOWED_CANONICAL_TARGETS: ReadonlyArray<string> = [
  "contact_name",
  "contact_email",
  "contact_phone",
  "contact_date_of_birth",
  "registration_target",
  "preferred_level",
];

function tryRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function validateIntakeForm(
  fields: IntakeFormFieldConfig[],
): IntakeFormValidationResult {
  const errors: IntakeFormValidationError[] = [];

  if (fields.length === 0) {
    return {
      is_valid: false,
      errors: [{ code: "no_fields", message: "Formulier heeft geen velden." }],
    };
  }

  const keys = new Set(fields.map((f) => f.key));

  for (const f of fields) {
    if (TYPES_WITH_OPTIONS.includes(f.field_type)) {
      if (!f.options || f.options.length === 0) {
        errors.push({
          code: "missing_options",
          field_key: f.key,
          message: `Veld ${f.key} vereist minimaal één optie.`,
        });
      }
    }
    if (f.validation && typeof f.validation === "object" && f.validation.pattern) {
      if (!tryRegex(f.validation.pattern)) {
        errors.push({
          code: "invalid_pattern",
          field_key: f.key,
          message: `Veld ${f.key} heeft een ongeldige regex.`,
        });
      }
    }
    if (
      f.canonical_target &&
      !ALLOWED_CANONICAL_TARGETS.includes(f.canonical_target)
    ) {
      errors.push({
        code: "invalid_canonical_target",
        field_key: f.key,
        message: `Veld ${f.key} heeft een onbekende canonical_target.`,
      });
    }
    if (
      f.show_if &&
      typeof f.show_if === "object" &&
      Object.prototype.hasOwnProperty.call(f.show_if, "field_key")
    ) {
      const tgt = f.show_if.field_key;
      if (!tgt) {
        errors.push({
          code: "show_if_empty_target",
          field_key: f.key,
          message: `Veld ${f.key} heeft een show-if zonder doel-veld.`,
        });
      } else if (!keys.has(tgt)) {
        errors.push({
          code: "show_if_missing_target",
          field_key: f.key,
          target_key: tgt,
          message: `Veld ${f.key} verwijst naar onbekend veld ${tgt}.`,
        });
      } else if (tgt === f.key) {
        errors.push({
          code: "show_if_self_reference",
          field_key: f.key,
          message: `Veld ${f.key} verwijst in show-if naar zichzelf.`,
        });
      }
    }
  }

  // Cyclus-detectie via DFS over show-if-graaf.
  const byKey = new Map<string, IntakeFormFieldConfig>();
  for (const f of fields) byKey.set(f.key, f);
  const flaggedCycles = new Set<string>();

  for (const start of fields) {
    if (
      !start.show_if ||
      typeof start.show_if !== "object" ||
      !Object.prototype.hasOwnProperty.call(start.show_if, "field_key") ||
      !start.show_if.field_key
    ) {
      continue;
    }
    const visited = new Set<string>([start.key]);
    const stack: string[] = [start.show_if.field_key];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (!cur) break;
      if (visited.has(cur)) {
        if (!flaggedCycles.has(start.key)) {
          flaggedCycles.add(start.key);
          errors.push({
            code: "show_if_cycle",
            field_key: start.key,
            message: `Veld ${start.key} zit in een show-if cyclus.`,
          });
        }
        break;
      }
      visited.add(cur);
      const next = byKey.get(cur)?.show_if?.field_key;
      if (next) stack.push(next);
    }
  }

  return { is_valid: errors.length === 0, errors };
}
