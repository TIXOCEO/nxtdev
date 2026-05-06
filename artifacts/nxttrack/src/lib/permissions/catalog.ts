/**
 * Single source of truth for tenant-level permission keys used by the custom
 * role engine. The catalog is grouped purely for the admin UI; storage is just
 * a flat string key in `tenant_role_permissions.permission`.
 *
 * Keep keys snake_case + namespaced like `<area>.<verb_object>` to keep them
 * readable in the database. New keys MUST be added here so the role editor
 * can show them.
 */

export interface PermissionDef {
  key: string;
  label: string;
  description?: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  description?: string;
  permissions: PermissionDef[];
}

export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    id: "members",
    label: "Leden & Groepen",
    description: "Wie mag leden en groepen beheren.",
    permissions: [
      { key: "members.view", label: "Leden bekijken" },
      { key: "members.create", label: "Leden uitnodigen / toevoegen" },
      { key: "members.edit", label: "Leden bewerken" },
      { key: "members.remove", label: "Leden verwijderen / deactiveren" },
      // Sprint F — soft-delete (archiveren) van leden.
      { key: "members.archive", label: "Leden archiveren / dearchiveren" },
      // Sprint E — financiële gegevens (IBAN / payment method) bekijken/bewerken.
      { key: "members.financial.view", label: "Financiële gegevens bekijken (IBAN)" },
      { key: "members.financial.manage", label: "Financiële gegevens bewerken" },
      { key: "groups.manage", label: "Groepen beheren" },
      { key: "memberships.manage", label: "Lidmaatschappen beheren" },
    ],
  },
  {
    id: "trainings",
    label: "Trainingen & Agenda",
    permissions: [
      { key: "trainings.view", label: "Trainingen bekijken" },
      { key: "trainings.create", label: "Trainingen aanmaken" },
      { key: "trainings.edit", label: "Trainingen bewerken / annuleren" },
      { key: "attendance.mark", label: "Aanwezigheid markeren" },
    ],
  },
  {
    id: "communication",
    label: "Communicatie",
    permissions: [
      { key: "news.publish", label: "Nieuws publiceren" },
      { key: "news.edit", label: "Nieuws bewerken / verwijderen" },
      { key: "notifications.send", label: "Handmatige meldingen versturen" },
      { key: "email_templates.manage", label: "E-mail templates beheren" },
      { key: "communication.alerts", label: "Alerts & aankondigingen beheren" },
    ],
  },
  {
    id: "social",
    label: "Social feed",
    description: "Wie mag de community-feed gebruiken en modereren.",
    permissions: [
      { key: "social.view", label: "Feed bekijken" },
      { key: "social.post", label: "Berichten plaatsen" },
      { key: "social.comment", label: "Reageren op berichten" },
      { key: "social.like", label: "Berichten liken" },
      { key: "social.moderate", label: "Modereren (verbergen / mute)" },
      { key: "social.settings", label: "Social-feed instellingen beheren" },
      { key: "social.broadcast", label: "Coach-broadcast plaatsen" },
      { key: "social.auto_posts", label: "Automatische posts toestaan" },
    ],
  },
  {
    id: "registrations",
    label: "Inschrijvingen",
    permissions: [
      { key: "registrations.view", label: "Inschrijvingen bekijken" },
      { key: "registrations.process", label: "Inschrijvingen verwerken / accepteren" },
    ],
  },
  {
    id: "cms",
    label: "CMS — Pagina's & Menu",
    permissions: [
      { key: "cms.pages.view", label: "Pagina's bekijken" },
      { key: "cms.pages.create", label: "Pagina's aanmaken" },
      { key: "cms.pages.edit", label: "Pagina's bewerken" },
      { key: "cms.pages.delete", label: "Pagina's verwijderen" },
      { key: "cms.pages.toggle", label: "Pagina's aan/uit zetten" },
      { key: "cms.menu.reorder", label: "Menu-volgorde wijzigen" },
      { key: "homepage.manage", label: "Homepage modules beheren" },
      { key: "media.manage", label: "Media Wall beheren" },
      { key: "sponsors.manage", label: "Sponsoren beheren" },
    ],
  },
  {
    id: "branding",
    label: "Branding & Thema's",
    permissions: [
      { key: "branding.profile", label: "Tenant profiel & logo bewerken" },
      { key: "branding.themes", label: "Thema's activeren / aanpassen" },
      { key: "branding.seo", label: "SEO instellingen aanpassen" },
      { key: "branding.social", label: "Social media links beheren" },
    ],
  },
  {
    id: "messages",
    label: "Berichten",
    permissions: [
      { key: "messages.use", label: "Berichten lezen en versturen" },
      { key: "messages.broadcast", label: "Naar meerdere leden of groepen tegelijk versturen" },
    ],
  },
  {
    id: "settings",
    label: "Instellingen",
    permissions: [
      { key: "settings.email", label: "E-mail instellingen" },
      { key: "settings.training", label: "Training instellingen" },
      { key: "settings.push", label: "Push instellingen" },
      { key: "settings.profile_pictures", label: "Profielfoto templates" },
      // Sprint F — beheer van betaalmogelijkheden (per-tenant CRUD).
      { key: "settings.payment_methods.manage", label: "Betaalmogelijkheden beheren" },
    ],
  },
  {
    id: "roles",
    label: "Rollen & Permissies",
    description: "Geef alleen aan vertrouwde personen — ze kunnen rechten herverdelen.",
    permissions: [
      { key: "roles.manage", label: "Rollen aanmaken en bewerken" },
      { key: "roles.assign", label: "Rollen aan leden toewijzen" },
    ],
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

export const PERMISSION_KEY_SET = new Set(ALL_PERMISSION_KEYS);

export function isValidPermissionKey(key: string): boolean {
  return PERMISSION_KEY_SET.has(key);
}

export function findPermission(key: string): PermissionDef | null {
  for (const g of PERMISSION_CATALOG) {
    const p = g.permissions.find((x) => x.key === key);
    if (p) return p;
  }
  return null;
}
