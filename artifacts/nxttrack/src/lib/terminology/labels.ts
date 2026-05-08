import type { TerminologyKey } from "./types";

/**
 * Mensvriendelijke labels per terminologie-key. Gebruikt door de
 * platform-admin editor en de tenant-profiel preview.
 */
export const TERMINOLOGY_KEY_LABELS: Record<TerminologyKey, string> = {
  member_singular:        "Lid (enkelvoud)",
  member_plural:          "Leden (meervoud)",
  participant_singular:   "Deelnemer (enkelvoud)",
  participant_plural:     "Deelnemers (meervoud)",
  guardian_singular:      "Ouder/verzorger (enkelvoud)",
  guardian_plural:        "Ouders/verzorgers (meervoud)",
  instructor_singular:    "Begeleider (enkelvoud)",
  instructor_plural:      "Begeleiders (meervoud)",
  group_singular:         "Groep (enkelvoud)",
  group_plural:           "Groepen (meervoud)",
  session_singular:       "Sessie (enkelvoud)",
  session_plural:         "Sessies (meervoud)",
  program_singular:       "Programma (enkelvoud)",
  program_plural:         "Programma's (meervoud, ook page-titel)",
  attendance_label:       "Aanwezigheidslabel",
  registration_singular:  "Aanmelding (enkelvoud)",
  registration_plural:    "Aanmeldingen (meervoud)",
  certificate_singular:   "Certificaat (enkelvoud)",
  certificate_plural:     "Certificaten (meervoud)",

  members_page_description:    "Leden-pagina beschrijving",
  groups_page_description:     "Groepen-pagina beschrijving",
  groups_new_form_title:       "Groepen — titel formulier 'nieuwe groep'",
  trainings_page_description:  "Trainingen-pagina beschrijving",
  trainings_new_button:        "Trainingen — knop 'nieuwe training'",
  memberships_page_description:"Lidmaatschappen-pagina beschrijving",
  memberships_new_form_title:  "Lidmaatschappen — titel formulier 'nieuw lidmaatschap'",
  dashboard_participants_hint: "Dashboard 'coming soon' — hint deelnemers",
  dashboard_instructors_hint:  "Dashboard 'coming soon' — hint instructeurs",

  waitlist_singular:           "Wachtlijst-aanvraag (enkelvoud)",
  waitlist_plural:             "Wachtlijst-aanvragen (meervoud)",
  waitlist_page_description:   "Wachtlijst-pagina beschrijving",
  makeup_singular:             "Inhaalsessie (enkelvoud)",
  makeup_plural:               "Inhaalsessies (meervoud)",
  makeup_credit_singular:      "Inhaalcredit (enkelvoud)",
  makeup_credit_plural:        "Inhaalcredits (meervoud)",
  milestone_singular:          "Mijlpaal (enkelvoud)",
  milestone_plural:            "Mijlpalen (meervoud)",
  milestone_event_singular:    "Mijlpaal-event (enkelvoud)",
  milestone_event_plural:      "Mijlpaal-events (meervoud)",
  progress_module_singular:    "Voortgangsmodule (enkelvoud)",
  progress_module_plural:      "Voortgangsmodules (meervoud)",
  capacity_resource_singular:  "Capaciteit / locatie (enkelvoud)",
  capacity_resource_plural:    "Capaciteiten / locaties (meervoud)",
};

export const TERMINOLOGY_KEYS = Object.keys(TERMINOLOGY_KEY_LABELS) as TerminologyKey[];
