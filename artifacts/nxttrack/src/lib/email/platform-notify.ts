import "server-only";

import sgMail from "@sendgrid/mail";
import { getEmailConfig } from "@/lib/config/email";
import { platformSender, resolveSender, type ResolvedSender } from "./resolve-sender";
import { listPlatformAdmins } from "@/lib/db/platform-admins";
import { createAdminClient } from "@/lib/supabase/admin";
import { appBaseUrl } from "@/lib/url";
import { wrapBrandedEmail } from "./branded-wrap";
import type { Tenant } from "@/types/database";

/**
 * Stuur een notificatie-mail naar ALLE platform admins.
 *
 * Bedoeld voor system-wide events: nieuwe inschrijving, nieuwe proefles,
 * nieuwe tenant aangemaakt, etc. — alles waar het NXTTRACK-team van op
 * de hoogte moet zijn.
 *
 * Bewust geen tenant-template: deze mails zijn platform-scope en mogen
 * niet door tenant admins bewerkt worden.
 *
 * Faalt nooit hard — fouten worden gelogd, de aanroepende flow blijft
 * doordraaien.
 */
export async function notifyPlatformAdmins(params: {
  subject: string;
  html: string;
  text: string;
  triggerSource: string;
  /** Optionele override: stuur uit naam van een tenant ipv het platform. */
  from?: ResolvedSender;
  /** Optionele Reply-To, bv. tenant contact-email. */
  replyTo?: string;
}): Promise<{ ok: boolean; sent: number; error?: string }> {
  try {
    const cfg = getEmailConfig();
    sgMail.setApiKey(cfg.apiKey);

    const admins = await listPlatformAdmins();
    if (admins.length === 0) {
      return { ok: true, sent: 0 };
    }

    const { fromName, fromEmail } = params.from ?? platformSender();
    const recipients = admins.map((a) => a.email).filter(Boolean);
    if (recipients.length === 0) return { ok: true, sent: 0 };

    await sgMail.send({
      to: recipients,
      from: { email: fromEmail, name: fromName },
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      subject: params.subject,
      html: params.html,
      text: params.text,
      // Per-recipient sends ipv één enkele mail met meerdere TO's, zodat
      // admins elkaars adres niet in hun client zien.
      isMultiple: true,
    });

    // Logging — best-effort.
    try {
      const admin = createAdminClient();
      await admin.from("email_logs").insert(
        recipients.map((r) => ({
          tenant_id: null,
          template_key: `platform:${params.triggerSource}`,
          recipient_email: r,
          subject: params.subject,
          status: "sent" as const,
          trigger_source: params.triggerSource,
          provider: "sendgrid",
          from_email: fromEmail,
        })),
      );
    } catch {
      /* logging failure shouldn't break the send */
    }

    return { ok: true, sent: recipients.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // eslint-disable-next-line no-console
    console.error("[platform-notify] send failed:", msg);
    return { ok: false, sent: 0, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────
// Templated builders
// ─────────────────────────────────────────────────────────────────

function row(label: string, value: unknown): string {
  const v = value === null || value === undefined || value === "" ? "—" : String(value);
  return `<tr>
    <td style="padding:4px 12px 4px 0;color:#6b7280;font-size:12px;vertical-align:top;white-space:nowrap;">${escape(
      label,
    )}</td>
    <td style="padding:4px 0;color:#111827;font-size:13px;">${escape(v)}</td>
  </tr>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface RegistrationLike {
  id: string;
  type: "tryout" | "registration";
  registration_target: "self" | "child" | string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  child_name: string | null;
  date_of_birth: string | null;
  player_type: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  extra_details: string | null;
  athletes_json?: unknown;
}

export async function notifyPlatformOfRegistration(params: {
  tenantName: string;
  tenantSlug: string;
  /** Optioneel: tenant-id zodat we de volledige branding (logo + kleur) kunnen ophalen. */
  tenantId?: string;
  registration: RegistrationLike;
}): Promise<void> {
  const r = params.registration;
  const isTryout = r.type === "tryout";
  const kind = isTryout ? "proefles" : "inschrijving";
  const subject = `Nieuwe ${kind} — ${params.tenantName}`;

  // Brand-data + email-settings ophalen — voor de visuele wrap én voor
  // de tenant-sender (From:) en Reply-To.
  let brandedTenant:
    | Pick<
        Tenant,
        | "name"
        | "slug"
        | "logo_url"
        | "domain"
        | "contact_email"
        | "primary_color"
        | "email_domain_verified"
      >
    | null = null;
  let tenantSenderName: string | null = null;
  let tenantReplyTo: string | null = null;
  if (params.tenantId) {
    try {
      const admin = createAdminClient();
      const [{ data: tdata }, { data: sdata }] = await Promise.all([
        admin
          .from("tenants")
          .select(
            "name, slug, logo_url, domain, contact_email, primary_color, email_domain_verified",
          )
          .eq("id", params.tenantId)
          .maybeSingle(),
        admin
          .from("tenant_email_settings")
          .select("default_sender_name, reply_to_email")
          .eq("tenant_id", params.tenantId)
          .maybeSingle(),
      ]);
      if (tdata) brandedTenant = tdata;
      tenantSenderName = sdata?.default_sender_name ?? null;
      tenantReplyTo = sdata?.reply_to_email ?? null;
    } catch {
      /* als brand-data niet lukt, vallen we terug op kale wrap met alleen naam */
    }
  }

  // Tenant-sender bepalen via dezelfde regels als alle andere tenant-mails.
  const senderTenant = brandedTenant ?? {
    name: params.tenantName,
    slug: params.tenantSlug,
    domain: null,
    contact_email: null,
    email_domain_verified: false,
  };
  const tenantFrom = resolveSender(
    senderTenant as Pick<Tenant, "name" | "slug" | "domain"> & {
      email_domain_verified?: boolean | null;
    },
    tenantSenderName ? { default_sender_name: tenantSenderName } : null,
  );
  const replyTo =
    tenantReplyTo ??
    brandedTenant?.contact_email ??
    undefined;

  // Voor "self" (proefles voor zichzelf) staat de naam van de aanmelder
  // in `child_name` (zie registrations-action). Voor "child" staat de
  // naam van de ouder in `parent_name` en de naam van het kind in
  // `child_name`. We tonen het label hier dus context-afhankelijk.
  const isChildTarget = r.registration_target === "child";
  const aanmelderNaam = isChildTarget ? r.parent_name : r.child_name ?? r.parent_name;

  const rows: string[] = [
    row("Tenant", `${params.tenantName} (${params.tenantSlug})`),
    row("Type", kind),
    row("Doelgroep", isChildTarget ? "Voor een kind" : "Voor zichzelf"),
    row(isChildTarget ? "Naam ouder/aanmelder" : "Naam", aanmelderNaam),
    row("E-mail", r.parent_email),
    row("Telefoon", r.parent_phone),
  ];
  if (isChildTarget) {
    rows.push(row("Naam kind", r.child_name));
  }
  if (r.date_of_birth) rows.push(row("Geboortedatum", r.date_of_birth));
  if (r.player_type) rows.push(row("Type speler", r.player_type));
  if (r.address) rows.push(row("Adres", r.address));
  if (r.postal_code || r.city) {
    rows.push(row("Plaats", `${r.postal_code ?? ""} ${r.city ?? ""}`.trim()));
  }
  if (r.extra_details) rows.push(row("Toelichting", r.extra_details));
  if (Array.isArray(r.athletes_json) && r.athletes_json.length > 0) {
    rows.push(
      row(
        "Sporters (gezin)",
        r.athletes_json
          .map((a) =>
            typeof a === "object" && a && "full_name" in a
              ? String((a as { full_name?: string }).full_name ?? "")
              : "",
          )
          .filter(Boolean)
          .join(", "),
      ),
    );
  }

  const adminLink = `${appBaseUrl()}/tenant/registrations`;
  const innerHtml = `
    <h1 style="font-size:20px;color:#111827;margin:0 0 6px;line-height:1.3;">Nieuwe ${escape(kind)}</h1>
    <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">Er is zojuist een nieuwe ${escape(kind)}-aanvraag binnengekomen.</p>
    <table style="border-collapse:collapse;width:100%;">
      ${rows.join("")}
    </table>
    <p style="margin-top:20px;">
      <a href="${escape(adminLink)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#111827;color:#fff;text-decoration:none;font-size:13px;font-weight:600;">Bekijk in admin</a>
    </p>
    <p style="color:#9ca3af;font-size:11px;margin-top:16px;">Registratie-ID: ${escape(r.id)}</p>
  `.trim();

  const innerText = [
    `Nieuwe ${kind} — ${params.tenantName}`,
    "",
    ...rows.map((html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()),
    "",
    `Bekijk in admin: ${adminLink}`,
    `ID: ${r.id}`,
  ].join("\n");

  // Branded wrap toepassen (logo + tenantkleur + footer) — gebruikt
  // de bekende tenant brand-data, of valt terug op een minimale wrap
  // met alleen de tenantnaam als header.
  const wrapped = wrapBrandedEmail({
    tenant: brandedTenant ?? {
      name: params.tenantName,
      slug: params.tenantSlug,
      logo_url: null,
      domain: null,
      contact_email: null,
      primary_color: "#b6d83b",
    },
    innerHtml,
    innerText,
    preheader: `Nieuwe ${kind} bij ${params.tenantName}`,
  });

  await notifyPlatformAdmins({
    subject,
    html: wrapped.html,
    text: wrapped.text,
    triggerSource: isTryout ? "new_tryout" : "new_registration",
    from: tenantFrom,
    replyTo,
  });
}
