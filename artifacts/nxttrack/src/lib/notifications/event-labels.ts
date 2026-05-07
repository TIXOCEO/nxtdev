/**
 * Friendly Dutch labels + descriptions for notification event_keys.
 * Used by the user-facing /t/[slug]/instellingen page so people can pick
 * which kinds of mails / pushes they want to receive.
 *
 * Unknown keys fall back to a humanized version of the key itself.
 *
 * Sprint 38 — `labelFor` accepts an optional `Terminology` so the
 * training_ and attendance_ labels render sector-aware (e.g. "Nieuwe
 * zwemles" voor swimming_school i.p.v. "Nieuwe training"). Zonder
 * terminology valt het terug op de generic-defaults.
 */
import type { Terminology } from "@/lib/terminology/types";

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

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Render a sector-aware version of the static label/description for the
 * keys waar dat zinvol is. Houdt grammatica simpel: woorden worden
 * gewoon ingesubstitueerd, geen verbuiging — dat is goed genoeg voor
 * NL-zinnen als "Nieuwe zwemles" of "Lesaanwezigheid bijgewerkt".
 */
function applyTerminology(
  eventKey: string,
  base: EventLabel,
  t: Terminology,
): EventLabel {
  const session = t.session_singular;
  const sessionLower = lower(session);
  const attendance = t.attendance_label;

  switch (eventKey) {
    case "training_created":
      return {
        label: `Nieuwe ${sessionLower}`,
        description: `Wanneer er een ${sessionLower} wordt ingepland voor jouw ${lower(t.group_singular)}.`,
      };
    case "training_updated":
      return {
        label: `Wijziging in ${sessionLower}`,
        description: `Wanneer een geplande ${sessionLower} wordt aangepast.`,
      };
    case "training_cancelled":
      return {
        label: `${session} afgelast`,
        description: `Wanneer een ${sessionLower} wordt geannuleerd.`,
      };
    case "training_reminder":
      return {
        label: `Herinnering ${sessionLower}`,
        description: "Korte reminder vlak voor aanvang.",
      };
    case "trainer_attendance_updated":
      return {
        label: `${attendance} bijgewerkt`,
        description: `Wanneer de ${lower(t.instructor_singular)} jouw ${lower(attendance)} heeft genoteerd.`,
      };
    case "social_training_recap":
      return {
        label: `${session}verslag`,
        description: `Wanneer er een verslag van een ${sessionLower} wordt geplaatst.`,
      };
    default:
      return base;
  }
}

export function labelFor(
  eventKey: string,
  terminology?: Terminology,
): EventLabel {
  const base = EVENT_LABELS[eventKey];
  if (base) {
    return terminology ? applyTerminology(eventKey, base, terminology) : base;
  }
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
