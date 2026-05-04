/**
 * Friendly Dutch labels + descriptions for notification event_keys.
 * Used by the user-facing /t/[slug]/instellingen page so people can pick
 * which kinds of mails / pushes they want to receive.
 *
 * Unknown keys fall back to a humanized version of the key itself.
 */
export interface EventLabel {
  label: string;
  description: string;
}

export const EVENT_LABELS: Record<string, EventLabel> = {
  notification: {
    label: "Algemene berichten",
    description: "Handmatige berichten die de club aan jou stuurt.",
  },
  news_published: {
    label: "Nieuws",
    description: "Wanneer er een nieuwsbericht wordt gepubliceerd.",
  },
  training_created: {
    label: "Nieuwe training",
    description: "Wanneer er een training wordt ingepland voor jouw groep.",
  },
  training_updated: {
    label: "Wijziging in training",
    description: "Wanneer een geplande training wordt aangepast.",
  },
  training_cancelled: {
    label: "Training afgelast",
    description: "Wanneer een training wordt geannuleerd.",
  },
  training_reminder: {
    label: "Herinnering training",
    description: "Korte reminder vlak voor aanvang.",
  },
  attendance_changed_late: {
    label: "Late afmelding",
    description: "Voor trainers — iemand meldt zich kort van tevoren af.",
  },
  trainer_attendance_updated: {
    label: "Aanwezigheid bijgewerkt",
    description: "Wanneer de trainer jouw aanwezigheid heeft genoteerd.",
  },
  new_registration_submitted: {
    label: "Nieuwe inschrijving",
    description: "Voor beheerders — er is een nieuwe inschrijving binnen.",
  },
  invite_accepted: {
    label: "Uitnodiging geaccepteerd",
    description: "Wanneer iemand jouw uitnodiging aanneemt.",
  },
  membership_assigned: {
    label: "Lidmaatschap toegekend",
    description: "Wanneer er een nieuw lidmaatschap aan je is gekoppeld.",
  },
  group_assigned: {
    label: "Groep toegewezen",
    description: "Wanneer je aan een nieuwe groep wordt toegevoegd.",
  },
  // ── Sprint 19: Social feed ──
  social_new_comment: {
    label: "Reactie op je bericht",
    description: "Wanneer iemand reageert op een bericht dat je hebt geplaatst.",
  },
  social_like: {
    label: "Like op je bericht",
    description: "Wanneer iemand je bericht een like geeft.",
  },
  social_mention: {
    label: "Vermelding (@mention)",
    description: "Wanneer iemand jou noemt in een bericht of reactie.",
  },
  social_coach_broadcast: {
    label: "Bericht van de trainer",
    description: "Wanneer de trainer een bericht plaatst.",
  },
  social_new_team_post: {
    label: "Nieuwe teampost",
    description: "Wanneer er een bericht voor jouw team verschijnt.",
  },
  social_achievement_shared: {
    label: "Prestatie gedeeld",
    description: "Wanneer er een prestatie of mijlpaal wordt gedeeld.",
  },
  social_training_recap: {
    label: "Trainingsverslag",
    description: "Wanneer er een verslag van een training wordt geplaatst.",
  },
};

export function labelFor(eventKey: string): EventLabel {
  if (EVENT_LABELS[eventKey]) return EVENT_LABELS[eventKey];
  return {
    label: eventKey
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    description: "",
  };
}

/** Sensible defaults shown when no notification_events rows exist for the tenant. */
export const DEFAULT_USER_VISIBLE_EVENTS: string[] = [
  "notification",
  "news_published",
  "training_created",
  "training_updated",
  "training_cancelled",
  "training_reminder",
  "trainer_attendance_updated",
];
