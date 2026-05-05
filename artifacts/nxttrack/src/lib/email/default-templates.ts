import "server-only";

/**
 * Seed catalogue: factory defaults for every template key.
 *
 * Tenants get their own row inserted on first seed; future updates to these
 * defaults do NOT overwrite tenant edits (the seed action does an
 * `on conflict (tenant_id, key) do nothing`).
 */
export interface DefaultTemplate {
  key: string;
  name: string;
  subject: string;
  content_html: string;
  content_text: string;
}

// Sprint 20: branded layout (logo header + tenant footer + opt-out disclaimer)
// is applied centrally in `send-email.ts` via `wrapBrandedEmail()`.
// Templates store ONLY the inner body, which is what the rich-text editor edits.
const wrap = (heading: string, body: string): string =>
  `<h1 style="font-size:20px;margin:0 0 14px;line-height:1.3;">${heading}</h1>
${body}`;

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    key: "welcome_member",
    name: "Welkom — nieuw lid",
    subject: "Welkom bij {{tenant_name}}, {{member_name}}!",
    content_html: wrap(
      "Welkom, {{member_name}}!",
      "<p>Je bent nu lid van <strong>{{tenant_name}}</strong>. We kijken ernaar uit je te zien.</p>",
    ),
    content_text:
      "Welkom, {{member_name}}!\n\nJe bent nu lid van {{tenant_name}}. We kijken ernaar uit je te zien.\n\n— {{tenant_name}}",
  },
  {
    key: "welcome_tryout",
    name: "Welkom — proeflesaanvraag",
    subject: "Bedankt voor je proeflesaanvraag bij {{tenant_name}}",
    content_html: wrap(
      "Bedankt, {{member_name}}!",
      "<p>We hebben je proeflesaanvraag ontvangen en nemen binnenkort contact op.</p>",
    ),
    content_text:
      "Bedankt, {{member_name}}!\n\nWe hebben je proeflesaanvraag ontvangen en nemen binnenkort contact op.\n\n— {{tenant_name}}",
  },
  {
    key: "notification",
    name: "Algemene notificatie",
    subject: "{{notification_title}} — {{tenant_name}}",
    content_html: wrap(
      "{{notification_title}}",
      "<p>Hallo {{member_name}},</p><p>{{notification_content}}</p>",
    ),
    content_text:
      "Hallo {{member_name}},\n\n{{notification_title}}\n\n{{notification_content}}\n\n— {{tenant_name}}",
  },
  {
    key: "newsletter",
    name: "Nieuwsbrief",
    subject: "{{news_title}} — {{tenant_name}}",
    content_html: wrap(
      "{{news_title}}",
      '<p>Lees het volledige bericht: <a href="{{news_url}}">{{news_url}}</a></p>',
    ),
    content_text:
      "{{news_title}}\n\nLees het volledige bericht: {{news_url}}\n\n— {{tenant_name}}",
  },
  {
    key: "payment_due",
    name: "Betaling — herinnering",
    subject: "Herinnering: betaling {{membership_name}}",
    content_html: wrap(
      "Betaalherinnering",
      "<p>Beste {{member_name}},</p><p>De betaling van <strong>€ {{membership_amount}}</strong> voor <strong>{{membership_name}}</strong> ({{membership_period}}) staat open. Vervaldatum: <strong>{{membership_due_date}}</strong>.</p>",
    ),
    content_text:
      "Beste {{member_name}},\n\nDe betaling van € {{membership_amount}} voor {{membership_name}} ({{membership_period}}) staat open. Vervaldatum: {{membership_due_date}}.\n\n— {{tenant_name}}",
  },
  {
    key: "payment_overdue",
    name: "Betaling — achterstallig",
    subject: "Achterstallige betaling: {{membership_name}}",
    content_html: wrap(
      "Achterstallige betaling",
      "<p>Beste {{member_name}},</p><p>De betaling van <strong>€ {{membership_amount}}</strong> voor <strong>{{membership_name}}</strong> is verlopen op {{membership_due_date}}. Graag zo spoedig mogelijk voldoen.</p>",
    ),
    content_text:
      "Beste {{member_name}},\n\nDe betaling van € {{membership_amount}} voor {{membership_name}} is verlopen op {{membership_due_date}}.\n\n— {{tenant_name}}",
  },
  {
    key: "account_invite",
    name: "Account uitnodiging",
    subject: "Je bent uitgenodigd voor {{tenant_name}}",
    content_html: wrap(
      "Je bent uitgenodigd",
      '<p>Hallo {{member_name}},</p><p>Klik op de onderstaande knop om je account aan te maken:</p><p><a href="{{invite_link}}" style="display:inline-block;padding:10px 16px;background:#b6d83b;color:#111;border-radius:8px;text-decoration:none;">Account aanmaken</a></p><p>Of gebruik deze code: <strong>{{invite_code}}</strong></p><p>Deze uitnodiging vervalt op {{expiry_date}}.</p>',
    ),
    content_text:
      "Hallo {{member_name}},\n\nMaak je account aan: {{invite_link}}\nCode: {{invite_code}}\nVervalt op: {{expiry_date}}\n\n— {{tenant_name}}",
  },
  {
    key: "staff_invite",
    name: "Account uitnodiging — staf/trainer",
    subject: "Welkom bij {{tenant_name}}, {{member_name}} — activeer je {{function_label}}-account",
    content_html: wrap(
      "Welkom bij het team, {{member_name}}!",
      '<p>We hebben een <strong>{{function_label}}</strong>-account voor je aangemaakt bij <strong>{{tenant_name}}</strong>. Je hoeft alleen nog je registratie af te ronden door een wachtwoord te kiezen.</p><p><a href="{{invite_link}}" style="display:inline-block;padding:10px 16px;background:#b6d83b;color:#111;border-radius:8px;text-decoration:none;">Account activeren</a></p><p>Of gebruik deze code: <strong>{{invite_code}}</strong></p><p>Deze uitnodiging vervalt op {{expiry_date}}.</p>',
    ),
    content_text:
      "Welkom bij het team, {{member_name}}!\n\nWe hebben een {{function_label}}-account voor je aangemaakt bij {{tenant_name}}. Rond je registratie af door een wachtwoord te kiezen: {{invite_link}}\nCode: {{invite_code}}\nVervalt op: {{expiry_date}}\n\n— {{tenant_name}}",
  },
  {
    key: "complete_account",
    name: "Account afronden",
    subject: "Rond je account af bij {{tenant_name}}",
    content_html: wrap(
      "Account afronden",
      '<p>Hallo {{member_name}},</p><p>Klik <a href="{{complete_registration_link}}">hier</a> om je registratie af te ronden.</p>',
    ),
    content_text:
      "Hallo {{member_name}},\n\nRond je registratie af: {{complete_registration_link}}\n\n— {{tenant_name}}",
  },
  {
    key: "parent_link_minor",
    name: "Ouder — koppel minderjarige",
    subject: "Koppel je kind aan je {{tenant_name}}-account",
    content_html: wrap(
      "Koppel je kind",
      '<p>Beste {{parent_name}},</p><p>Klik <a href="{{minor_link_url}}">hier</a> om <strong>{{athlete_name}}</strong> aan je account te koppelen.</p>',
    ),
    content_text:
      "Beste {{parent_name}},\n\nKoppel {{athlete_name}}: {{minor_link_url}}\n\n— {{tenant_name}}",
  },
  {
    key: "minor_added",
    name: "Minderjarige toegevoegd",
    subject: "{{athlete_name}} is toegevoegd aan je account",
    content_html: wrap(
      "Kind toegevoegd",
      "<p>Beste {{parent_name}},</p><p><strong>{{athlete_name}}</strong> is succesvol gekoppeld aan je account.</p>",
    ),
    content_text:
      "Beste {{parent_name}},\n\n{{athlete_name}} is succesvol gekoppeld aan je account.\n\n— {{tenant_name}}",
  },
  {
    key: "athlete_code_link",
    name: "Sporter — koppelcode",
    subject: "Je {{tenant_name}} koppelcode",
    content_html: wrap(
      "Je koppelcode",
      "<p>Hallo {{athlete_name}},</p><p>Je persoonlijke code is: <strong>{{athlete_code}}</strong></p>",
    ),
    content_text:
      "Hallo {{athlete_name}},\n\nJe persoonlijke code is: {{athlete_code}}\n\n— {{tenant_name}}",
  },
  {
    key: "invite_expired",
    name: "Uitnodiging — verlopen",
    subject: "Je uitnodiging voor {{tenant_name}} is verlopen",
    content_html: wrap(
      "Uitnodiging verlopen",
      "<p>Beste {{member_name}},</p><p>Je uitnodiging is verlopen op {{expiry_date}}. Neem contact op om een nieuwe te ontvangen.</p>",
    ),
    content_text:
      "Beste {{member_name}},\n\nJe uitnodiging is verlopen op {{expiry_date}}.\n\n— {{tenant_name}}",
  },
  {
    key: "invite_reminder",
    name: "Uitnodiging — herinnering",
    subject: "Herinnering: maak je {{tenant_name}}-account aan",
    content_html: wrap(
      "Vergeet je uitnodiging niet",
      '<p>Beste {{member_name}},</p><p>Je uitnodiging vervalt binnenkort. <a href="{{invite_link}}">Account aanmaken</a></p>',
    ),
    content_text:
      "Beste {{member_name}},\n\nJe uitnodiging vervalt binnenkort: {{invite_link}}\n\n— {{tenant_name}}",
  },
  {
    key: "registration_converted",
    name: "Aanmelding omgezet naar lid",
    subject: "Welkom als lid van {{tenant_name}}",
    content_html: wrap(
      "Welkom als lid",
      "<p>Beste {{member_name}},</p><p>Je aanmelding is omgezet naar een volwaardig lidmaatschap.</p>",
    ),
    content_text:
      "Beste {{member_name}},\n\nJe aanmelding is omgezet naar een volwaardig lidmaatschap.\n\n— {{tenant_name}}",
  },
  {
    key: "parent_register_then_link",
    name: "Ouder — registreer eerst, koppel daarna kind",
    subject: "Maak een account aan om {{athlete_name}} te koppelen",
    content_html: wrap(
      "Maak eerst je account aan",
      '<p>Beste {{parent_name}},</p>' +
      '<p>Voor <strong>{{athlete_name}}</strong> is een persoonlijke koppelcode aangemaakt bij <strong>{{tenant_name}}</strong>. ' +
      'Je hebt nog geen account bij ons. Maak eerst je account aan via onderstaande knop:</p>' +
      '<p><a href="{{register_link}}" style="display:inline-block;padding:10px 16px;background:#b6d83b;color:#111;border-radius:8px;text-decoration:none;">Account aanmaken</a></p>' +
      '<p>Zodra je account klaar is, ga je naar <strong>Mijn profiel → Mijn gezin</strong> en voer je deze koppelcode in:</p>' +
      '<p style="font-size:18px;letter-spacing:2px;font-weight:bold;">{{invite_code}}</p>' +
      '<p>Daarmee koppel je {{athlete_name}} aan je account zodat je alles voor je kind kunt regelen.</p>' +
      '<p>De code vervalt op {{expiry_date}}.</p>',
    ),
    content_text:
      "Beste {{parent_name}},\n\n" +
      "Voor {{athlete_name}} is een koppelcode aangemaakt bij {{tenant_name}}. Je hebt nog geen account.\n\n" +
      "1. Maak eerst je account aan: {{register_link}}\n" +
      "2. Ga daarna naar Mijn profiel > Mijn gezin en voer deze code in:\n\n   {{invite_code}}\n\n" +
      "De code vervalt op {{expiry_date}}.\n\n— {{tenant_name}}",
  },
  {
    key: "parent_link_with_code",
    name: "Ouder — koppel kind met code (bestaand account)",
    subject: "Koppel {{athlete_name}} aan je {{tenant_name}}-account",
    content_html: wrap(
      "Koppel {{athlete_name}} aan je account",
      '<p>Beste {{parent_name}},</p>' +
      '<p>Voor <strong>{{athlete_name}}</strong> is een koppelcode aangemaakt. Log in op je account en ga naar <strong>Mijn profiel → Mijn gezin</strong> om {{athlete_name}} toe te voegen met de onderstaande code:</p>' +
      '<p style="font-size:18px;letter-spacing:2px;font-weight:bold;">{{invite_code}}</p>' +
      '<p><a href="{{login_link}}" style="display:inline-block;padding:10px 16px;background:#b6d83b;color:#111;border-radius:8px;text-decoration:none;">Inloggen</a></p>' +
      '<p>De code vervalt op {{expiry_date}}.</p>',
    ),
    content_text:
      "Beste {{parent_name}},\n\n" +
      "Voor {{athlete_name}} is een koppelcode aangemaakt. Log in op je account ({{login_link}}) en ga naar Mijn profiel > Mijn gezin. Voer daar deze code in:\n\n" +
      "   {{invite_code}}\n\n" +
      "De code vervalt op {{expiry_date}}.\n\n— {{tenant_name}}",
  },
  {
    key: "group_announcement",
    name: "Groep — mededeling",
    subject: "Mededeling voor {{group_name}}",
    content_html: wrap(
      "Mededeling — {{group_name}}",
      "<p>Beste {{member_name}},</p><p>{{news_title}}</p>",
    ),
    content_text:
      "Beste {{member_name}},\n\n{{news_title}}\n\n— {{tenant_name}} ({{group_name}})",
  },
];
