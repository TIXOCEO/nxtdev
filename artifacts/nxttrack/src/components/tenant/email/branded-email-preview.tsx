"use client";

import type { Tenant } from "@/types/database";

interface Props {
  tenant: Pick<Tenant, "name" | "logo_url" | "domain" | "contact_email" | "primary_color">;
  innerHtml: string;
  preheader?: string | null;
}

/**
 * Client-side mirror of `wrapBrandedEmail()` (see lib/email/branded-wrap.ts).
 * Used in the editor preview so admins see exactly what the recipient gets.
 *
 * Kept visually identical to the real email — same 600px card, accent line,
 * footer with website / contact / opt-out disclaimer.
 */
export function BrandedEmailPreview({ tenant, innerHtml, preheader }: Props) {
  const accent = tenant.primary_color || "#b6d83b";
  const website =
    tenant.domain && tenant.domain.trim()
      ? tenant.domain.startsWith("http")
        ? tenant.domain
        : `https://${tenant.domain}`
      : null;

  return (
    <div
      className="rounded-2xl border p-4 sm:p-6"
      style={{
        background: "#f4f4f6",
        borderColor: "var(--surface-border)",
      }}
    >
      {preheader && (
        <p className="mb-2 truncate text-xs" style={{ color: "#888" }}>
          <span className="font-semibold">Preheader:</span> {preheader}
        </p>
      )}
      <div
        className="mx-auto w-full overflow-hidden rounded-xl border bg-white"
        style={{ maxWidth: 600, borderColor: "#e6e6ea" }}
      >
        <div
          className="flex justify-center px-6 py-7"
          style={{ borderBottom: `3px solid ${accent}`, background: "#fff" }}
        >
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              style={{ maxHeight: 64, maxWidth: 240, height: "auto", width: "auto" }}
            />
          ) : (
            <div
              style={{ fontSize: 22, fontWeight: 700, color: "#111", letterSpacing: ".2px" }}
            >
              {tenant.name}
            </div>
          )}
        </div>
        <div
          className="px-7 pb-4 pt-7"
          style={{
            fontFamily:
              "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
            fontSize: 15,
            lineHeight: 1.55,
            color: "#111",
          }}
          dangerouslySetInnerHTML={{ __html: innerHtml }}
        />
        <div
          className="px-7 py-6"
          style={{
            borderTop: "1px solid #eef0f2",
            background: "#fafbfc",
            fontFamily:
              "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
            fontSize: 12,
            lineHeight: 1.55,
            color: "#666",
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 600, color: "#333", marginBottom: 4 }}>{tenant.name}</div>
          <div>
            {website && (
              <a
                href={website}
                style={{ color: "#444", textDecoration: "underline" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {website && tenant.contact_email && " · "}
            {tenant.contact_email && (
              <a
                href={`mailto:${tenant.contact_email}`}
                style={{ color: "#444", textDecoration: "underline" }}
              >
                {tenant.contact_email}
              </a>
            )}
          </div>
          <div style={{ marginTop: 14, color: "#888" }}>
            Je ontvangt deze e-mail omdat je een account hebt bij {tenant.name}.
            E-mailmeldingen kun je beheren of uitzetten via je profielinstellingen op de website.
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px]" style={{ color: "#9aa0a6" }}>
        Verstuurd via NXTTRACK
      </p>
    </div>
  );
}
