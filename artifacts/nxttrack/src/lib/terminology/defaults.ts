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
  attendance_label: "Aanwezigheid",
  registration_singular: "Aanmelding",
  registration_plural: "Aanmeldingen",
  certificate_singular: "Certificaat",
  certificate_plural: "Certificaten",

  members_page_description:
    "Beheer ouders, deelnemers, begeleiders en staf van deze academie.",
  groups_page_description:
    "Maak groepen aan en koppel deelnemers eraan.",
  groups_new_form_title: "Nieuwe groep",
  trainings_page_description:
    "Plan sessies voor groepen, beheer status en aanwezigheid.",
  trainings_new_button: "Nieuwe sessie",
  memberships_page_description:
    "Definieer programma's voor deze academie.",
  memberships_new_form_title: "Nieuw programma",
  dashboard_participants_hint: "Beheer deelnemers en groepen.",
  dashboard_instructors_hint: "Begeleidersbestand en koppelingen.",
};
