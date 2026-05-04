"use client";

import { useState, useTransition } from "react";
import { Plug, Send, Server, CheckCircle2, XCircle } from "lucide-react";
import {
  testSmtpConnection,
  sendRawTestEmail,
} from "@/lib/actions/platform/email";
import type { ProviderStatus } from "@/lib/config/email";
import { slugifyForEmail } from "@/lib/email/slugify-for-email";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  email_domain_verified: boolean;
}

export interface StatusPanelProps {
  status: ProviderStatus;
  /** Base domain used for the per-tenant subdomain fallback. */
  baseDomain: string;
  tenants: TenantOption[];
}

const inputCls =
  "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";
const inputStyle = {
  borderColor: "var(--surface-border)",
  color: "var(--text-primary)",
  backgroundColor: "var(--surface-main)",
} as const;

export function StatusPanel({ status, baseDomain, tenants }: StatusPanelProps) {
  const [pending, startTransition] = useTransition();
  const [verifyMsg, setVerifyMsg] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const [testTo, setTestTo] = useState("");
  const [tenantId, setTenantId] = useState<string>("");
  const [testMsg, setTestMsg] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  function verify() {
    setVerifyMsg(null);
    startTransition(async () => {
      const res = await testSmtpConnection();
      setVerifyMsg(
        res.ok
          ? { kind: "ok", text: "SendGrid API key verified." }
          : { kind: "err", text: res.error },
      );
    });
  }

  function sendTest() {
    setTestMsg(null);
    startTransition(async () => {
      const res = await sendRawTestEmail({
        to: testTo,
        subject: "NXTTRACK SendGrid test",
        body: "This is a test message from the NXTTRACK platform admin via SendGrid.",
        tenant_id: tenantId || null,
      });
      setTestMsg(
        res.ok
          ? {
              kind: "ok",
              text: `Sent to ${testTo} from ${res.data.fromEmail ?? "(unknown)"}.`,
            }
          : { kind: "err", text: res.error },
      );
    });
  }

  return (
    <div className="space-y-6">
      {/* ── status grid ─────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoTile label="Provider" value={providerLabel(status.provider)} />
        <InfoTile label="Transport" value="HTTPS API" />
        <div className="sm:col-span-2">
          <InfoTile
            label="API key"
            value={
              status.configured
                ? "Configured"
                : `Missing: ${status.missing.join(", ")}`
            }
            ok={status.configured}
          />
        </div>
      </div>

      {verifyMsg && (
        <p
          className={
            verifyMsg.kind === "ok"
              ? "text-sm text-emerald-600"
              : "text-sm text-red-600"
          }
        >
          {verifyMsg.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={verify}
          disabled={pending || !status.configured}
          className="inline-flex h-10 items-center gap-2 rounded-xl border bg-transparent px-4 text-sm font-medium disabled:opacity-50"
          style={{
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
          title={status.configured ? "" : "Set SENDGRID_API_KEY first"}
        >
          <Plug className="h-4 w-4" /> Test connection
        </button>
      </div>

      <hr style={{ borderColor: "var(--surface-border)" }} />

      {/* ── send test email ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Server
            className="mt-0.5 h-4 w-4"
            style={{ color: "var(--text-secondary)" }}
          />
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Send test email
            </h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              When a tenant is selected, the From: identity is resolved
              against that tenant&rsquo;s domain (verified custom domain →{" "}
              <code>no-reply@&lt;domain&gt;</code>, otherwise the shared
              platform sender with the tenant name as display name, e.g.{" "}
              <code>&quot;Tenant Name&quot; &lt;no-reply@nxttrack.nl&gt;</code>).
              With no tenant selected, the platform default sender is used.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Recipient *">
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className={inputCls}
              style={inputStyle}
              placeholder="recipient@example.com"
            />
          </Field>
          <Field label="Tenant (optional)">
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">— platform default sender —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({senderPreview(t, baseDomain)})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={sendTest}
            disabled={pending || !testTo || !status.configured}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-primary)",
            }}
          >
            <Send className="h-4 w-4" /> Send
          </button>
        </div>
        {testMsg && (
          <p
            className={
              testMsg.kind === "ok"
                ? "text-sm text-emerald-600"
                : "text-sm text-red-600"
            }
          >
            {testMsg.text}
          </p>
        )}
      </div>
    </div>
  );
}

function providerLabel(p: string): string {
  if (p === "sendgrid") return "SendGrid (API)";
  return p;
}

function senderPreview(t: TenantOption, baseDomain: string): string {
  void baseDomain;
  const customDomain = t.domain?.trim().toLowerCase();
  if (t.email_domain_verified && customDomain)
    return `no-reply@${customDomain}`;
  return `"${t.name}" via shared sender`;
}

function InfoTile({
  label,
  value,
  mono,
  ok,
}: {
  label: string;
  value: string;
  mono?: boolean;
  ok?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-soft)",
      }}
    >
      <div
        className="text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </div>
      <div
        className={`mt-1 flex items-center gap-1.5 text-sm ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--text-primary)" }}
      >
        {ok === true && (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        )}
        {ok === false && <XCircle className="h-4 w-4 text-red-600" />}
        <span>{value}</span>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="mb-1 block text-xs font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
