"use client";

import { useState } from "react";
import { Globe, Copy, Check, ExternalLink, AlertCircle } from "lucide-react";

export interface CustomDomainCardProps {
  tenantSlug: string;
  currentDomain: string | null;
  apexDomain: string;
  vpsIp: string;
}

/**
 * Read-only informatie + DNS-instructies voor het custom domein van een
 * tenant. Het domein zelf wordt elders (TenantForm) bewerkt — hier tonen
 * we de huidige status, de DNS-records die de admin moet aanmaken, en
 * uitleg over hoe het automatische certificate-aanvraagsysteem werkt.
 */
export function CustomDomainCard({
  tenantSlug,
  currentDomain,
  apexDomain,
  vpsIp,
}: CustomDomainCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  }

  const fallbackUrl = `https://${tenantSlug}.${apexDomain}`;

  return (
    <section className="space-y-3">
      <h2
        className="text-sm font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        Custom domein
      </h2>

      <div
        className="rounded-2xl border p-6 space-y-4"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <header className="flex items-center gap-2">
          <Globe className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            Huidig domein:{" "}
            {currentDomain ? (
              <a
                href={`https://${currentDomain}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono font-semibold underline"
              >
                {currentDomain}
              </a>
            ) : (
              <span style={{ color: "var(--text-secondary)" }}>
                Geen — bezoekers gebruiken{" "}
                <a
                  href={fallbackUrl}
                  className="font-mono underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {tenantSlug}.{apexDomain}
                </a>
              </span>
            )}
          </p>
        </header>

        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Voer hierboven (in &quot;Tenant details&quot;) een eigen domein
          in en sla op. Volg daarna deze stappen in Cloudflare/de DNS-host
          van het domein. Een TLS-certificaat wordt automatisch aangevraagd
          zodra DNS doorvoert — geen handmatige certbot-actie nodig.
        </p>

        {currentDomain && (
          <>
            <div className="space-y-2">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-secondary)" }}
              >
                1. DNS records aanmaken
              </p>
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <DnsRow
                  label="Type"
                  values={["A", "A"]}
                />
                <DnsRow
                  label="Naam"
                  values={["@", "www"]}
                  copyKeys={[`${currentDomain}-root`, `${currentDomain}-www`]}
                  onCopy={copy}
                  copiedKey={copiedKey}
                />
                <DnsRow
                  label="Waarde"
                  values={[vpsIp, vpsIp]}
                  copyKeys={[`${currentDomain}-ip-1`, `${currentDomain}-ip-2`]}
                  onCopy={copy}
                  copiedKey={copiedKey}
                />
                <DnsRow
                  label="Proxy"
                  values={["Proxied (oranje wolk)", "Proxied (oranje wolk)"]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-secondary)" }}
              >
                2. Cloudflare SSL-modus
              </p>
              <ul
                className="list-disc space-y-1 pl-5 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                <li>SSL/TLS → Overview → <strong>Full (strict)</strong></li>
                <li>Edge Certificates → <strong>Always Use HTTPS = Aan</strong></li>
                <li>
                  Voor de <em>eerste</em> cert-aanvraag: zet de proxy
                  tijdelijk op <strong>DNS only</strong> (grijze wolk),
                  wacht ~30 sec tot Caddy het cert heeft, en zet daarna
                  terug op Proxied.
                </li>
              </ul>
            </div>

            <div
              className="flex items-start gap-2 rounded-xl border p-3 text-xs"
              style={{
                borderColor: "var(--surface-border)",
                backgroundColor: "var(--surface-soft)",
                color: "var(--text-secondary)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Zodra DNS naar de juiste server wijst regelt het platform
                automatisch het Let&apos;s Encrypt certificaat. Klik{" "}
                <a
                  href={`https://${currentDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 underline"
                >
                  hier <ExternalLink className="h-3 w-3" />
                </a>{" "}
                om te testen — eerste laad kan 5-10 sec duren door
                cert-issuance.
              </p>
            </div>
          </>
        )}

        {!currentDomain && (
          <p
            className="rounded-xl border p-3 text-xs"
            style={{
              borderColor: "var(--surface-border)",
              backgroundColor: "var(--surface-soft)",
              color: "var(--text-secondary)",
            }}
          >
            Voeg een custom domein toe (zonder https:// of pad, bv.{" "}
            <code className="font-mono">voetbalschool-houtrust.nl</code>) en
            sla op. Daarna verschijnen hier de DNS-instructies.
          </p>
        )}
      </div>
    </section>
  );
}

interface DnsRowProps {
  label: string;
  values: string[];
  copyKeys?: string[];
  onCopy?: (value: string, key: string) => void;
  copiedKey?: string | null;
}

function DnsRow({ label, values, copyKeys, onCopy, copiedKey }: DnsRowProps) {
  return (
    <div
      className="grid grid-cols-[80px_1fr_1fr] items-center gap-2 border-b px-3 py-2 text-xs last:border-b-0"
      style={{ borderColor: "var(--surface-border)" }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      {values.map((v, i) => {
        const key = copyKeys?.[i];
        const isCopied = key && copiedKey === key;
        return (
          <span
            key={i}
            className="flex items-center justify-between gap-1 font-mono"
            style={{ color: "var(--text-primary)" }}
          >
            <span className="truncate">{v}</span>
            {key && onCopy && (
              <button
                type="button"
                onClick={() => onCopy(v, key)}
                className="shrink-0 rounded-md p-1 hover:bg-black/5"
                title="Kopieer"
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3 opacity-60" />
                )}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
