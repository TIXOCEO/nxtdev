"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { upsertTenantEmailSettings } from "@/lib/actions/tenant/email";
import type { TenantEmailSettings } from "@/types/database";

export interface EmailSettingsFormProps {
  tenantId: string;
  initial: TenantEmailSettings | null;
}

const inputCls =
  "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";
const inputStyle = {
  borderColor: "var(--surface-border)",
  color: "var(--text-primary)",
  backgroundColor: "var(--surface-main)",
} as const;

export function EmailSettingsForm({ tenantId, initial }: EmailSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initial?.emails_enabled ?? true);
  const [senderName, setSenderName] = useState(initial?.default_sender_name ?? "");
  const [replyTo, setReplyTo] = useState(initial?.reply_to_email ?? "");
  const [expiry, setExpiry] = useState(String(initial?.invite_expiry_days ?? 2));
  const [maxResend, setMaxResend] = useState(String(initial?.max_resend_count ?? 3));
  const [cooldown, setCooldown] = useState(
    String(initial?.resend_cooldown_days ?? 1),
  );
  const [reminderEnabled, setReminderEnabled] = useState(
    initial?.reminder_enabled ?? true,
  );
  const [reminderAfter, setReminderAfter] = useState(
    String(initial?.reminder_after_days ?? 1),
  );
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await upsertTenantEmailSettings({
        tenant_id: tenantId,
        emails_enabled: enabled,
        default_sender_name: senderName,
        reply_to_email: replyTo,
        invite_expiry_days: expiry,
        max_resend_count: maxResend,
        resend_cooldown_days: cooldown,
        reminder_enabled: reminderEnabled,
        reminder_after_days: reminderAfter,
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Instellingen opgeslagen." });
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
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
          E-mails inschakelen voor deze vereniging
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Standaard afzendernaam">
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className={inputCls}
              style={inputStyle}
              placeholder="Bijv. SV Voorbeeld"
            />
          </Field>
          <Field label="Antwoordadres (reply-to)">
            <input
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              className={inputCls}
              style={inputStyle}
              placeholder="info@voorbeeld.nl"
            />
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Leeg laten? Antwoorden gaan dan naar het contact-e-mailadres
              van deze organisatie.
            </p>
          </Field>
        </div>
      </div>

      <hr style={{ borderColor: "var(--surface-border)" }} />

      <div>
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Uitnodigingsregels
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Geldigheid uitnodiging (dagen)">
            <input
              inputMode="numeric"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="Maximaal aantal opnieuw versturen">
            <input
              inputMode="numeric"
              value={maxResend}
              onChange={(e) => setMaxResend(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="Cooldown tussen verzendingen (dagen)">
            <input
              inputMode="numeric"
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="Herinnering na (dagen)">
            <input
              inputMode="numeric"
              value={reminderAfter}
              onChange={(e) => setReminderAfter(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </Field>
        </div>
        <label
          className="mt-3 inline-flex items-center gap-2 text-sm"
          style={{ color: "var(--text-primary)" }}
        >
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(e) => setReminderEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Herinneringen versturen
        </label>
      </div>

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
