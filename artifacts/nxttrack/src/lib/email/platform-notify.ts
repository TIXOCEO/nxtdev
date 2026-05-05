import "server-only";

import sgMail from "@sendgrid/mail";
import { getEmailConfig } from "@/lib/config/email";
import { platformSender } from "./resolve-sender";
import { listPlatformAdmins } from "@/lib/db/platform-admins";
import { createAdminClient } from "@/lib/supabase/admin";

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
}): Promise<{ ok: boolean; sent: number; error?: string }> {
  try {
    const cfg = getEmailConfig();
    sgMail.setApiKey(cfg.apiKey);

    const admins = await listPlatformAdmins();
    if (admins.length === 0) {
      return { ok: true, sent: 0 };
    }

    const { fromName, fromEmail } = platformSender();
    const recipients = admins.map((a) => a.email).filter(Boolean);
    if (recipients.length === 0) return { ok: true, sent: 0 };

    await sgMail.send({
      to: recipients,
      from: { email: fromEmail, name: fromName },
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
  registration: RegistrationLike;
}): Promise<void> {
  const r = params.registration;
  const isTryout = r.type === "tryout";
  const kind = isTryout ? "proefles" : "inschrijving";
  const subject = `[NXTTRACK] Nieuwe ${kind} — ${params.tenantName}`;

  const rows: string[] = [
    row("Tenant", `${params.tenantName} (${params.tenantSlug})`),
    row("Type", kind),
    row("Doelgroep", r.registration_target === "child" ? "Voor een kind" : "Voor zichzelf"),
    row("Naam (ouder/aanmelder)", r.parent_name),
    row("E-mail", r.parent_email),
    row("Telefoon", r.parent_phone),
  ];
  if (r.registration_target === "child") {
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

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="font-size:18px;color:#111827;margin:0 0 4px;">Nieuwe ${escape(kind)} — ${escape(params.tenantName)}</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">Er is zojuist een nieuwe ${escape(kind)}-aanvraag binnengekomen.</p>
      <table style="border-collapse:collapse;width:100%;">
        ${rows.join("")}
      </table>
      <p style="color:#9ca3af;font-size:11px;margin-top:24px;">Bekijken in admin: <a href="https://nxttrack.nl/tenant/registrations">/tenant/registrations</a> · Registratie-ID: ${escape(r.id)}</p>
    </div>
  `.trim();

  const text = [
    `Nieuwe ${kind} — ${params.tenantName}`,
    "",
    ...rows.map((html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()),
    "",
    `ID: ${r.id}`,
  ].join("\n");

  await notifyPlatformAdmins({
    subject,
    html,
    text,
    triggerSource: isTryout ? "new_tryout" : "new_registration",
  });
}
