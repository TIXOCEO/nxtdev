/**
 * Sector terminology — single source of truth voor alle dynamische
 * UI-labels die per tenant kunnen verschillen.
 *
 * Houd deze lijst smal en stabiel: iedere key is een 1-op-1 zichtbaar
 * concept (singular / plural). Voor afgeleide combi-strings ("Beheer X
 * en Y") componeer je in de view via deze keys.
 */
export interface Terminology {
  /** Generieke roster-term (parents + athletes + trainers + staf samen). */
  member_singular: string;
  member_plural: string;
  /** Specifiek de sportende deelnemer (athlete/learner). */
  participant_singular: string;
  participant_plural: string;
  guardian_singular: string;
  guardian_plural: string;
  instructor_singular: string;
  instructor_plural: string;
  group_singular: string;
  group_plural: string;
  session_singular: string;
  session_plural: string;
  program_singular: string;
  program_plural: string;
  /**
   * Page-title voor het programmabeheer-scherm. Apart van `program_plural`
   * omdat de bestaande NL-UI hier "Abonnementen" gebruikt terwijl de
   * sidebar "Lidmaatschappen" toont — discrepantie blijft tot een
   * vervolgsprint die deze samenvoegt.
   */
  program_page_title: string;
  attendance_label: string;
  registration_singular: string;
  registration_plural: string;
  certificate_singular: string;
  certificate_plural: string;
}

export type TerminologyKey = keyof Terminology;
