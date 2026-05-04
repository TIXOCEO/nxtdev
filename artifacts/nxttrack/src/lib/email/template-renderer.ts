/**
 * Mustache-style `{{variable}}` substitution for email templates.
 *
 * - Whitespace inside the braces is tolerated: `{{ name }}` works.
 * - Unknown variables resolve to an empty string (per Sprint 9 spec).
 * - Variable names match `[a-zA-Z0-9_]+`. Anything else is left as-is.
 */
export type TemplateVariables = Record<string, string | number | null | undefined>;

const MUSTACHE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderTemplateString(
  source: string,
  variables: TemplateVariables,
): string {
  return source.replace(MUSTACHE_RE, (_match, name: string) => {
    const v = variables[name];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

/** Convenience: render a template's subject + html + text in one pass. */
export function renderTemplate(
  template: { subject: string; content_html: string; content_text?: string | null },
  variables: TemplateVariables,
): { subject: string; html: string; text: string | null } {
  return {
    subject: renderTemplateString(template.subject, variables),
    html: renderTemplateString(template.content_html, variables),
    text:
      template.content_text == null
        ? null
        : renderTemplateString(template.content_text, variables),
  };
}

/** Whitelist of variables advertised in the editor's helper bar. */
export const SUPPORTED_VARIABLES: readonly string[] = [
  "tenant_name",
  "tenant_logo_url",
  "tenant_contact_email",
  "member_name",
  "parent_name",
  "athlete_name",
  "trainer_name",
  "invite_link",
  "invite_code",
  "athlete_code",
  "complete_registration_link",
  "minor_link_url",
  "group_name",
  "news_title",
  "news_url",
  "notification_title",
  "notification_content",
  "membership_name",
  "membership_amount",
  "membership_due_date",
  "membership_period",
  "current_date",
  "expiry_date",
] as const;
