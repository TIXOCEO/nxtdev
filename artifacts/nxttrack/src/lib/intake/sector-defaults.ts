import type { IntakeFormConfig, IntakeFormFieldConfig } from "./types";

/**
 * Sprint 65 — Code-side sector-defaults.
 *
 * Built-in formulieren per sector als statische TypeScript-config.
 * Wanneer een tenant `dynamic_intake_enabled=true` heeft maar nog
 * géén eigen formulier in `intake_forms`, valt de resolver hier op
 * terug zodat de publieke pagina meteen werkt.
 *
 * Sprint 66 vervangt deze defaults door per-tenant DB-rijen via de
 * form-builder. Sprint 71 verhuist ze naar `sector_templates`-rows.
 */

const FROZEN_TS = "2026-05-16T00:00:00.000Z";

function field(
  key: string,
  label: string,
  field_type: IntakeFormFieldConfig["field_type"],
  extra: Partial<IntakeFormFieldConfig> = {},
): IntakeFormFieldConfig {
  return {
    key,
    label,
    field_type,
    is_required: false,
    ...extra,
  };
}

const COMMON_CONTACT_FIELDS: IntakeFormFieldConfig[] = [
  field("registration_target", "Voor wie is deze aanvraag?", "radio", {
    is_required: true,
    canonical_target: "registration_target",
    options: [
      { value: "self", label: "Ik schrijf mezelf in" },
      { value: "child", label: "Ik schrijf mijn kind in" },
    ],
    sort_order: 10,
  }),
  field("contact_name", "Volledige naam", "text", {
    is_required: true,
    canonical_target: "contact_name",
    sort_order: 20,
  }),
  field("child_name", "Naam kind", "text", {
    is_required: true,
    show_if: { field_key: "registration_target", equals: "child" },
    sort_order: 25,
  }),
  field("contact_email", "E-mail", "email", {
    is_required: true,
    canonical_target: "contact_email",
    sort_order: 30,
  }),
  field("contact_phone", "Telefoon", "phone", {
    is_required: true,
    canonical_target: "contact_phone",
    sort_order: 40,
  }),
  field("date_of_birth", "Geboortedatum", "date", {
    is_required: true,
    canonical_target: "contact_date_of_birth",
    sort_order: 50,
  }),
];

const FOOTBALL_TRYOUT: IntakeFormConfig = {
  id: "default:football_school:tryout",
  slug: "tryout-default",
  name: "Proefles — voetbalschool",
  status: "published",
  is_default: true,
  submission_type: "trial_lesson",
  updated_at: FROZEN_TS,
  source: "sector-default",
  fields: [
    ...COMMON_CONTACT_FIELDS,
    field("player_type", "Type speler", "select", {
      is_required: true,
      options: [
        { value: "player", label: "Speler" },
        { value: "goalkeeper", label: "Keeper" },
      ],
      sort_order: 60,
    }),
    field("extra_details", "Extra details", "textarea", {
      help_text: "Optioneel — bijvoorbeeld huidige club of ervaring.",
      validation: { maxLength: 1500 },
      sort_order: 80,
    }),
    field("agreed_terms", "Ik ga akkoord met de voorwaarden", "consent", {
      is_required: true,
      sort_order: 100,
    }),
  ],
};

const SWIMMING_TRYOUT: IntakeFormConfig = {
  id: "default:swimming_school:tryout",
  slug: "tryout-default",
  name: "Proefles — zwemschool",
  status: "published",
  is_default: true,
  submission_type: "trial_lesson",
  updated_at: FROZEN_TS,
  source: "sector-default",
  fields: [
    ...COMMON_CONTACT_FIELDS,
    field("current_level", "Huidig niveau", "select", {
      help_text: "Optioneel — selecteer indien bekend.",
      canonical_target: "preferred_level",
      options: [
        { value: "watervrij", label: "Watervrij / nog geen ervaring" },
        { value: "A", label: "Werkt aan zwemdiploma A" },
        { value: "B", label: "Werkt aan zwemdiploma B" },
        { value: "C", label: "Werkt aan zwemdiploma C" },
        { value: "anders", label: "Anders" },
      ],
      sort_order: 60,
    }),
    field("extra_details", "Extra details", "textarea", {
      help_text: "Optioneel — eerdere zwemervaring, angst voor water, etc.",
      validation: { maxLength: 1500 },
      sort_order: 80,
    }),
    field("agreed_terms", "Ik ga akkoord met de voorwaarden", "consent", {
      is_required: true,
      sort_order: 100,
    }),
  ],
};

const GENERIC_TRYOUT: IntakeFormConfig = {
  id: "default:generic:tryout",
  slug: "tryout-default",
  name: "Proefles — algemeen",
  status: "published",
  is_default: true,
  submission_type: "trial_lesson",
  updated_at: FROZEN_TS,
  source: "sector-default",
  fields: [
    ...COMMON_CONTACT_FIELDS,
    field("extra_details", "Extra details", "textarea", {
      help_text: "Optioneel — laat ons weten wat we moeten weten.",
      validation: { maxLength: 1500 },
      sort_order: 80,
    }),
    field("agreed_terms", "Ik ga akkoord met de voorwaarden", "consent", {
      is_required: true,
      sort_order: 100,
    }),
  ],
};

export const SECTOR_DEFAULT_FORMS: Record<string, IntakeFormConfig> = {
  football_school: FOOTBALL_TRYOUT,
  swimming_school: SWIMMING_TRYOUT,
  generic: GENERIC_TRYOUT,
};

export function getSectorDefaultForm(
  sectorTemplateKey: string | null | undefined,
): IntakeFormConfig {
  if (sectorTemplateKey && SECTOR_DEFAULT_FORMS[sectorTemplateKey]) {
    return SECTOR_DEFAULT_FORMS[sectorTemplateKey];
  }
  return SECTOR_DEFAULT_FORMS.generic;
}
