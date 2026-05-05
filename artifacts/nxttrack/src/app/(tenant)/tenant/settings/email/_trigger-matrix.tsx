"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertEmailTrigger } from "@/lib/actions/tenant/email";
import { TRIGGER_EVENTS } from "@/lib/validation/email-triggers";
import type { EmailTrigger } from "@/types/database";

const EVENT_LABELS: Record<string, string> = {
  member_created: "Lid aangemaakt",
  tryout_registered: "Proefles aangevraagd",
  registration_submitted: "Inschrijving ontvangen",
  registration_converted: "Aanmelding omgezet",
  membership_assigned: "Abonnement toegewezen",
  payment_due: "Betaling open",
  payment_overdue: "Betaling achterstallig",
  account_invite_sent: "Uitnodiging verstuurd",
  account_invite_reminder: "Uitnodiging herinnering",
  account_invite_expired: "Uitnodiging verlopen",
  group_announcement_posted: "Groep mededeling",
  news_published: "Nieuwsbericht gepubliceerd",
  parent_link_no_account: "Ouder koppelt kind — ouder zonder account",
  parent_link_existing_account: "Ouder koppelt kind — ouder met account",
  minor_added_to_parent: "Kind toegevoegd aan ouder",
};

export interface TriggerMatrixProps {
  tenantId: string;
  triggers: EmailTrigger[];
  templates: Array<{ key: string; name: string }>;
}

export function TriggerMatrix({ tenantId, triggers, templates }: TriggerMatrixProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial: Record<string, { template_key: string; enabled: boolean }> = {};
  for (const t of triggers) {
    initial[t.event_key] = { template_key: t.template_key, enabled: t.enabled };
  }
  const [state, setState] = useState(initial);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function persist(eventKey: string, next: { template_key: string; enabled: boolean }) {
    if (!next.template_key) return;
    setSavingKey(eventKey);
    setMsg(null);
    startTransition(async () => {
      const res = await upsertEmailTrigger({
        tenant_id: tenantId,
        event_key: eventKey,
        template_key: next.template_key,
        enabled: next.enabled,
      });
      setSavingKey(null);
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      router.refresh();
    });
  }

  if (templates.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Plaats eerst de standaard templates voordat je triggers kunt instellen.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
        {TRIGGER_EVENTS.map((evt) => {
          const cur = state[evt] ?? { template_key: "", enabled: true };
          return (
            <li
              key={evt}
              className="grid grid-cols-1 items-center gap-2 py-2.5 sm:grid-cols-[1fr_minmax(200px,260px)_auto]"
            >
              <span
                className="text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                {EVENT_LABELS[evt] ?? evt}
                <span
                  className="ml-2 font-mono text-[11px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {evt}
                </span>
              </span>
              <select
                value={cur.template_key}
                disabled={pending && savingKey === evt}
                onChange={(e) => {
                  const next = { ...cur, template_key: e.target.value };
                  setState((s) => ({ ...s, [evt]: next }));
                  persist(evt, next);
                }}
                className="h-9 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--surface-main)",
                }}
              >
                <option value="">— Geen template —</option>
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
              <label
                className="inline-flex items-center justify-end gap-2 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                <input
                  type="checkbox"
                  checked={cur.enabled}
                  disabled={!cur.template_key || (pending && savingKey === evt)}
                  onChange={(e) => {
                    const next = { ...cur, enabled: e.target.checked };
                    setState((s) => ({ ...s, [evt]: next }));
                    persist(evt, next);
                  }}
                  className="h-4 w-4"
                />
                Actief
              </label>
            </li>
          );
        })}
      </ul>
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
    </div>
  );
}
