/**
 * Sector terminology — single source of truth voor alle dynamische
 * UI-labels die per tenant kunnen verschillen.
 *
 * Houd deze lijst smal en stabiel: iedere key is een 1-op-1 zichtbaar
 * concept (singular / plural) of één afgewerkte UI-volzin. Voor afgeleide
 * combi-strings componeer je in de view via deze keys.
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
  /**
   * Meervoud van programma/lidmaatschap. Single source-of-truth voor
   * zowel sidebar-label als de page-title van het programmabeheer-scherm
   * (sprint 37 heeft de eerdere `program_page_title`-discrepantie hiermee
   * opgeheven — geen aparte page-title key meer).
   */
  program_plural: string;
  attendance_label: string;
  registration_singular: string;
  registration_plural: string;
  certificate_singular: string;
  certificate_plural: string;

  // ── Sector-aware volzin-strings (sprint 37) ───────────────────────────
  // Page-`description` velden onder `<PageHeading>` en knop-/sectie-titels
  // die bewust per sector een eigen formulering kunnen krijgen omdat
  // automatisch componeren met `toLowerCase()` snel rare grammatica
  // oplevert.
  members_page_description: string;
  groups_page_description: string;
  groups_new_form_title: string;
  trainings_page_description: string;
  trainings_new_button: string;
  memberships_page_description: string;
  memberships_new_form_title: string;
  /** Hint onder dashboard-card "Coming soon" → deelnemers/players. */
  dashboard_participants_hint: string;
  /** Hint onder dashboard-card "Coming soon" → instructeurs/trainers. */
  dashboard_instructors_hint: string;

  // ── Sprint 47 — Zwemschool-modules (waitlist, makeup, milestone, capacity) ──
  waitlist_singular: string;
  waitlist_plural: string;
  waitlist_page_description: string;
  makeup_singular: string;
  makeup_plural: string;
  makeup_credit_singular: string;
  makeup_credit_plural: string;
  milestone_singular: string;
  milestone_plural: string;
  milestone_event_singular: string;
  milestone_event_plural: string;
  progress_module_singular: string;
  progress_module_plural: string;
  capacity_resource_singular: string;
  capacity_resource_plural: string;

  // ── Sprint 60 — Programs MVP ──────────────────────────────────────────
  programs_page_description: string;
  programs_marketplace_title: string;
  programs_marketplace_intro: string;
  programs_new_button: string;
  program_assignment_lead_label: string;
  membership_plan_singular: string;
  membership_plan_plural: string;
}

export type TerminologyKey = keyof Terminology;
