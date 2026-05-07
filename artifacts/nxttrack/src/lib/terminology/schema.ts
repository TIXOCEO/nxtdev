import { z } from "zod";
import type { Terminology, TerminologyKey } from "./types.ts";

const NonEmpty = z.string().trim().min(1);

/**
 * Zod-validatie voor sector-template / per-tenant overrides bij ingestie.
 *
 * - Alle keys zijn `optional` zodat partial overrides geldig zijn.
 * - Onbekende keys worden via `.strip()` (default) genegeerd.
 * - Niet-string of lege waardes falen de parse — de resolver vangt dat
 *   af met een safe-parse en valt terug op de baseline (nooit throwen).
 */
export const TerminologySchema: z.ZodType<Partial<Terminology>> = z.object({
  member_singular:        NonEmpty.optional(),
  member_plural:          NonEmpty.optional(),
  participant_singular:   NonEmpty.optional(),
  participant_plural:     NonEmpty.optional(),
  guardian_singular:      NonEmpty.optional(),
  guardian_plural:        NonEmpty.optional(),
  instructor_singular:    NonEmpty.optional(),
  instructor_plural:      NonEmpty.optional(),
  group_singular:         NonEmpty.optional(),
  group_plural:           NonEmpty.optional(),
  session_singular:       NonEmpty.optional(),
  session_plural:         NonEmpty.optional(),
  program_singular:       NonEmpty.optional(),
  program_plural:         NonEmpty.optional(),
  attendance_label:       NonEmpty.optional(),
  registration_singular:  NonEmpty.optional(),
  registration_plural:    NonEmpty.optional(),
  certificate_singular:   NonEmpty.optional(),
  certificate_plural:     NonEmpty.optional(),

  members_page_description:    NonEmpty.optional(),
  groups_page_description:     NonEmpty.optional(),
  groups_new_form_title:       NonEmpty.optional(),
  trainings_page_description:  NonEmpty.optional(),
  trainings_new_button:        NonEmpty.optional(),
  memberships_page_description:NonEmpty.optional(),
  memberships_new_form_title:  NonEmpty.optional(),
  dashboard_participants_hint: NonEmpty.optional(),
  dashboard_instructors_hint:  NonEmpty.optional(),
});

/**
 * Veilige parse die nooit throwt: onbekende of vervuilde input → leeg
 * partial → resolver gebruikt de lager-prioriteit baseline.
 */
export function safeParseTerminology(input: unknown): Partial<Terminology> {
  const r = TerminologySchema.safeParse(input);
  if (!r.success) return {};
  const out: Partial<Terminology> = {};
  for (const [k, v] of Object.entries(r.data) as [TerminologyKey, string | undefined][]) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
