import "server-only";
import type { Tenant } from "@/types/database";

/**
 * Sprint 20 — Branded e-mail layout shell.
 *
 * Wraps the inner content of any tenant e-mail with:
 *   1. Tenant logo, centered, top of message (falls back to tenant name).
 *   2. The body (already-substituted HTML coming from the template/newsletter).
 *   3. A footer with website / contact info and a textual disclaimer that
 *      e-mails can be turned off in the user's account.
 *
 * Inline CSS only — many e-mail clients (Gmail, Outlook) strip <style>.
 * Width capped at 600px (common e-mail-safe width).
 */

export interface BrandedWrapInput {
  tenant: Pick<Tenant, "name" | "slug" | "logo_url" | "domain" | "contact_email" | "primary_color">;
  innerHtml: string;
  /** Optional preheader (hidden text shown in inbox preview). */
  preheader?: string | null;
  /** Optional plaintext fallback for `text/plain` part. */
  innerText?: string | null;
}

export interface BrandedWrapOutput {
  html: string;
  text: string;
}

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

function tenantWebsite(tenant: BrandedWrapInput["tenant"]): string | null {
  if (tenant.domain) {
    const d = tenant.domain.trim();
    if (!d) return null;
    return d.startsWith("http://") || d.startsWith("https://") ? d : `https://${d}`;
  }
  return null;
}

export function wrapBrandedEmail(input: BrandedWrapInput): BrandedWrapOutput {
  const { tenant, innerHtml, preheader, innerText } = input;
  const accent = tenant.primary_color || "#b6d83b";
  const website = tenantWebsite(tenant);
  const contact = tenant.contact_email?.trim() || null;

  const headerLogo = tenant.logo_url
    ? `<img src="${esc(tenant.logo_url)}" alt="${esc(tenant.name)}" style="max-height:64px;max-width:240px;height:auto;width:auto;display:block;margin:0 auto;" />`
    : `<div style="font-size:22px;font-weight:700;color:#111;letter-spacing:.2px;">${esc(tenant.name)}</div>`;

  const websiteLine = website
    ? `<a href="${esc(website)}" style="color:#444;text-decoration:underline;">${esc(website.replace(/^https?:\/\//, ""))}</a>`
    : "";
  const contactLine = contact
    ? `<a href="mailto:${esc(contact)}" style="color:#444;text-decoration:underline;">${esc(contact)}</a>`
    : "";
  const websiteSeparator = website && contact ? " &middot; " : "";

  const preheaderHtml = preheader
    ? `<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">${esc(preheader)}</div>`
    : "";

  const html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(tenant.name)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f6;-webkit-text-size-adjust:100%;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f6;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e6ea;">
      <tr>
        <td align="center" style="padding:28px 24px 20px;border-bottom:3px solid ${esc(accent)};background:#ffffff;">
          ${headerLogo}
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;">
          ${innerHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 28px;border-top:1px solid #eef0f2;background:#fafbfc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.55;color:#666;text-align:center;">
          <div style="font-weight:600;color:#333;margin-bottom:4px;">${esc(tenant.name)}</div>
          <div>${websiteLine}${websiteSeparator}${contactLine}</div>
          <div style="margin-top:14px;color:#888;">
            Je ontvangt deze e-mail omdat je een account hebt bij ${esc(tenant.name)}.
            E-mailmeldingen kun je beheren of uitzetten via je profielinstellingen op de website.
          </div>
        </td>
      </tr>
    </table>
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#9aa0a6;margin-top:14px;">
      Verstuurd via NXTTRACK
    </div>
  </td></tr>
</table>
</body>
</html>`;

  const websiteText = website ? `Website: ${website}` : "";
  const contactText = contact ? `Contact: ${contact}` : "";
  const contactBlock = [websiteText, contactText].filter(Boolean).join(" | ");

  const baseText =
    innerText ??
    innerHtml
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const text = `${tenant.name}
${"-".repeat(Math.min(tenant.name.length, 40))}

${baseText}

${contactBlock ? contactBlock + "\n\n" : ""}Je ontvangt deze e-mail omdat je een account hebt bij ${tenant.name}.
E-mailmeldingen kun je beheren of uitzetten via je profielinstellingen op de website.
`;

  return { html, text };
}
