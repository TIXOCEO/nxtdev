import { z } from "zod";
import type {
  IntakeFormConfig,
  IntakeFormFieldConfig,
  IntakeShowIf,
} from "./types";

/**
 * Sprint 65 — Bouwt een Zod-schema uit een IntakeFormConfig.
 *
 * Wordt zowel op de client (renderer/validatie) als server-side
 * (re-build vóór insert) gebruikt. Server-side is leidend — we
 * vertrouwen nooit een door de client meegegeven schema.
 *
 * Show-if (MVP, single-clause `equals`): hidden velden worden
 * `.optional()` zodat ze niet faal-valideren wanneer ze leeg zijn.
 * Visibility wordt opnieuw geëvalueerd ná `safeParse` met
 * `isFieldVisible()` — verborgen velden worden uit de payload
 * gestript.
 */

function fieldZod(f: IntakeFormFieldConfig): z.ZodTypeAny {
  let s: z.ZodTypeAny;
  switch (f.field_type) {
    case "text":
    case "textarea": {
      let str = z.string().trim();
      if (f.validation?.maxLength) str = str.max(f.validation.maxLength);
      s = str;
      break;
    }
    case "email":
      s = z.string().trim().email("Voer een geldig e-mailadres in.");
      break;
    case "phone":
      s = z
        .string()
        .trim()
        .min(6, "Voer een geldig telefoonnummer in.")
        .max(40);
      break;
    case "date":
      s = z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Gebruik formaat JJJJ-MM-DD.");
      break;
    case "number": {
      let n = z.coerce.number();
      if (f.validation?.min !== undefined) n = n.min(f.validation.min);
      if (f.validation?.max !== undefined) n = n.max(f.validation.max);
      s = n;
      break;
    }
    case "select":
    case "radio": {
      const values = (f.options ?? []).map((o) => o.value);
      if (values.length === 0) {
        s = z.string().trim();
      } else {
        s = z.enum(values as [string, ...string[]]);
      }
      break;
    }
    case "multiselect": {
      const values = (f.options ?? []).map((o) => o.value);
      if (values.length === 0) {
        s = z.array(z.string());
      } else {
        s = z.array(z.enum(values as [string, ...string[]]));
      }
      break;
    }
    case "checkbox":
    case "consent":
      s = z.boolean();
      break;
    default:
      s = z.unknown();
  }

  if (f.is_required) {
    if (f.field_type === "consent") {
      s = (s as z.ZodBoolean).refine((v) => v === true, {
        message: "Je moet akkoord gaan om door te gaan.",
      });
    } else if (
      f.field_type === "text" ||
      f.field_type === "textarea" ||
      f.field_type === "email" ||
      f.field_type === "phone" ||
      f.field_type === "date"
    ) {
      s = (s as z.ZodString).min(1, "Dit veld is verplicht.");
    } else if (f.field_type === "multiselect") {
      s = (s as z.ZodArray<z.ZodString>).min(1, "Maak ten minste één keuze.");
    }
  } else {
    s = s.optional().or(z.literal("")).or(z.null());
  }

  return s;
}

/**
 * Evalueer single-clause show-if. Wanneer hidden, mag het veld
 * leeg/ongedefinieerd zijn.
 */
export function isFieldVisible(
  showIf: IntakeShowIf | null | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!showIf) return true;
  const v = values[showIf.field_key];
  if (typeof showIf.equals === "boolean") return Boolean(v) === showIf.equals;
  if (typeof showIf.equals === "number") return Number(v) === showIf.equals;
  return String(v ?? "") === String(showIf.equals);
}

/**
 * Bouwt een lazy schema dat per-veld kijkt of het zichtbaar is.
 * Voor verborgen velden wordt de Zod-check effectief geskipt door
 * `.optional()` op alle velden te zetten en in `superRefine` voor
 * elk *zichtbaar* required-veld opnieuw te checken.
 */
export function buildZodFromFormConfig(
  form: IntakeFormConfig,
): z.ZodTypeAny {
  // BELANGRIJK — shape-level is volledig permissief (`z.unknown()`).
  // Een verborgen, verplicht veld dat in de defaults op `""` staat zou
  // anders de strict shape-check al laten falen vóór `superRefine`
  // visibility-aware kan strippen. We checken types + required pas in
  // de superRefine voor velden die volgens `show_if` zichtbaar zijn.
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of form.fields) {
    shape[f.key] = z.unknown();
  }

  return z
    .object(shape)
    .passthrough()
    .superRefine((data, ctx) => {
      const values = data as Record<string, unknown>;
      for (const f of form.fields) {
        if (!isFieldVisible(f.show_if, values)) continue;
        // Re-valideer met de echte (niet-optional) shape voor zichtbare velden.
        const realSchema = fieldZod(f);
        const v = values[f.key];
        const result = realSchema.safeParse(v);
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              ...issue,
              path: [f.key, ...(issue.path as Array<string | number>)],
            });
          }
        }
      }
    });
}

// Module-scope memoization op (form.id + form.updated_at).
const SCHEMA_CACHE = new Map<string, z.ZodTypeAny>();

export function buildZodFromFormConfigMemo(
  form: IntakeFormConfig,
): z.ZodTypeAny {
  const cacheKey = `${form.id}:${form.updated_at}`;
  const hit = SCHEMA_CACHE.get(cacheKey);
  if (hit) return hit;
  const built = buildZodFromFormConfig(form);
  SCHEMA_CACHE.set(cacheKey, built);
  return built;
}
