"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Eye, Save, Send } from "lucide-react";
import {
  updateEmailTemplate,
  sendTemplateTestEmail,
} from "@/lib/actions/tenant/email";
import { SUPPORTED_VARIABLES } from "@/lib/email/template-renderer";
import { TipTapEditor } from "@/components/ui/tiptap-editor";
import { BrandedEmailPreview } from "@/components/tenant/email/branded-email-preview";
import type { EmailTemplate, Tenant } from "@/types/database";

export interface TemplateEditorProps {
  template: EmailTemplate;
  tenant: Tenant;
}

const inputCls =
  "w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50";
const inputStyle = {
  borderColor: "var(--surface-border)",
  color: "var(--text-primary)",
  backgroundColor: "var(--surface-main)",
} as const;

export function TemplateEditor({ template, tenant }: TemplateEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState(template.subject);
  const [html, setHtml] = useState(template.content_html);
  const [text, setText] = useState(template.content_text ?? "");
  const [enabled, setEnabled] = useState(template.is_enabled);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateEmailTemplate({
        id: template.id,
        tenant_id: tenant.id,
        subject,
        content_html: html,
        content_text: text,
        is_enabled: enabled,
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Template opgeslagen." });
      router.refresh();
    });
  }

  function sendTest() {
    setTestMsg(null);
    startTransition(async () => {
      const res = await sendTemplateTestEmail({
        tenant_id: tenant.id,
        template_key: template.key,
        to: testTo,
      });
      setTestMsg(
        res.ok
          ? { kind: "ok", text: `Verstuurd naar ${testTo}.` }
          : { kind: "err", text: res.error },
      );
    });
  }

  function insertVar(name: string) {
    setHtml((prev) => prev + ` {{${name}}}`);
  }

  const previewSubject = useMemo(
    () => substituteSample(subject, tenant),
    [subject, tenant],
  );
  const previewHtml = useMemo(
    () => substituteSample(html, tenant),
    [html, tenant],
  );

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div
        className="inline-flex rounded-xl border p-1"
        style={{
          borderColor: "var(--surface-border)",
          backgroundColor: "var(--surface-main)",
        }}
      >
        {(["edit", "preview"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium"
              style={
                active
                  ? {
                      backgroundColor: "var(--accent)",
                      color: "var(--text-primary)",
                    }
                  : { color: "var(--text-secondary)" }
              }
            >
              {t === "edit" ? "Bewerken" : (
                <>
                  <Eye className="h-3.5 w-3.5" /> Voorbeeld
                </>
              )}
            </button>
          );
        })}
      </div>

      {tab === "edit" ? (
        <div
          className="rounded-2xl border p-4 sm:p-6"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <div className="space-y-3">
            <Field label="Onderwerp">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={`${inputCls} h-10`}
                style={inputStyle}
              />
            </Field>

            <Field
              label="Inhoud (rich-text)"
              hint="Het logo, de footer met website-info en de uitschrijf-tekst worden automatisch toegevoegd bij verzenden."
            >
              <TipTapEditor
                value={html}
                onChange={setHtml}
                placeholder="Schrijf hier de inhoud van de e-mail..."
                minHeight={320}
              />
            </Field>

            <Field label="Tekst inhoud (optioneel — fallback voor mail clients zonder HTML)">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={`${inputCls} font-mono`}
                style={{ ...inputStyle, minHeight: 120 }}
                spellCheck={false}
              />
            </Field>

            <div>
              <p
                className="mb-1 text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Beschikbare variabelen (klik om in te voegen)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUPPORTED_VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVar(v)}
                    className="rounded-md border px-1.5 py-0.5 font-mono text-[11px]"
                    style={{
                      borderColor: "var(--surface-border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>

            <label
              className="inline-flex items-center gap-2 text-sm"
              style={{ color: "var(--text-primary)" }}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              Template is ingeschakeld
            </label>

            {msg && (
              <p
                className={
                  msg.kind === "ok"
                    ? "text-sm text-emerald-600"
                    : "text-sm text-red-600"
                }
              >
                {msg.text}
              </p>
            )}

            <div>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--text-primary)",
                }}
              >
                <Save className="h-4 w-4" /> Opslaan
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Onderwerp
          </p>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {previewSubject}
          </p>
          <BrandedEmailPreview tenant={tenant} innerHtml={previewHtml} />
        </div>
      )}

      {/* Test send */}
      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Testmail versturen
        </h3>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Verstuurt de <strong>opgeslagen</strong> versie van deze template
          (incl. logo, footer en uitschrijf-tekst) met voorbeeldvariabelen.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="ontvanger@voorbeeld.nl"
            className={`${inputCls} h-10 flex-1`}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={sendTest}
            disabled={pending || !testTo}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-primary)",
            }}
          >
            <Send className="h-4 w-4" /> Verstuur test
          </button>
        </div>
        {testMsg && (
          <p
            className={
              testMsg.kind === "ok"
                ? "mt-2 text-sm text-emerald-600"
                : "mt-2 text-sm text-red-600"
            }
          >
            {testMsg.text}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
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
      {hint && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Preview-only sample substitution for {{variables}}. */
function substituteSample(src: string, tenant: Tenant): string {
  const samples: Record<string, string> = {
    tenant_name: tenant.name,
    tenant_logo_url: tenant.logo_url ?? "",
    tenant_contact_email: tenant.contact_email ?? "",
    member_name: "Jan Janssen",
    parent_name: "Marie Janssen",
    athlete_name: "Lotte Janssen",
    trainer_name: "Trainer Pieter",
    invite_link: "https://voorbeeld.nl/invite/abc123",
    invite_code: "ABC123",
    athlete_code: "ATH001",
    complete_registration_link: "https://voorbeeld.nl/registreren",
    minor_link_url: "https://voorbeeld.nl/koppel-kind",
    group_name: "Selectie U12",
    news_title: "Belangrijke update over de competitie",
    news_url: "https://voorbeeld.nl/nieuws/update",
    notification_title: "Nieuwe melding",
    notification_content: "Er is een nieuw bericht voor je.",
    membership_name: "Jaarlidmaatschap 2026",
    membership_amount: "120,00",
    membership_due_date: "31-05-2026",
    membership_period: "2026",
    current_date: new Date().toLocaleDateString("nl-NL"),
    expiry_date: "30-06-2026",
  };
  return src.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) =>
    samples[k] !== undefined ? samples[k] : `{{${k}}}`,
  );
}
