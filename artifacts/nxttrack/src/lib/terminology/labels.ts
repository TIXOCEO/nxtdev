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
  program_plural:         "Programma's (meervoud)",
  program_page_title:     "Programma-pagina titel",
  attendance_label:       "Aanwezigheidslabel",
  registration_singular:  "Aanmelding (enkelvoud)",
  registration_plural:    "Aanmeldingen (meervoud)",
  certificate_singular:   "Certificaat (enkelvoud)",
  certificate_plural:     "Certificaten (meervoud)",
};

export const TERMINOLOGY_KEYS = Object.keys(TERMINOLOGY_KEY_LABELS) as TerminologyKey[];
