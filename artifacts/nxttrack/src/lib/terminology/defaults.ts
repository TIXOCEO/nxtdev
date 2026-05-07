import type { Terminology } from "./types";

/**
 * Hardcoded ultieme fallback. Mag NOOIT throwen of leeg zijn — als de
 * resolver geen template kan laden, valt de UI hier op terug en blijft
 * werkbaar. Inhoudelijk gelijk aan de `generic` sector template zodat
 * niets sector-specifieks lekt.
 */
export const DEFAULT_TERMINOLOGY: Terminology = {
  member_singular: "Lid",
  member_plural: "Leden",
  participant_singular: "Deelnemer",
  participant_plural: "Deelnemers",
  guardian_singular: "Ouder/verzorger",
  guardian_plural: "Ouders/verzorgers",
  instructor_singular: "Begeleider",
  instructor_plural: "Begeleiders",
  group_singular: "Groep",
  group_plural: "Groepen",
  session_singular: "Sessie",
  session_plural: "Sessies",
  program_singular: "Programma",
  program_plural: "Programma's",
  program_page_title: "Programma's",
  attendance_label: "Aanwezigheid",
  registration_singular: "Aanmelding",
  registration_plural: "Aanmeldingen",
  certificate_singular: "Certificaat",
  certificate_plural: "Certificaten",
};
