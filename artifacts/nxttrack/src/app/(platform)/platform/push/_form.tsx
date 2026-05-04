"use client";

import { useState, useTransition } from "react";
import { Copy, KeyRound, Check } from "lucide-react";
import {
  generateVapidKeys,
  savePlatformPushSettings,
} from "@/lib/actions/platform/push";

export interface PlatformPushFormProps {
  initial: {
    vapid_public_key: string | null;
    vapid_subject: string;
    allowed_event_keys: string[];
  };
  eventKeys: string[];
}

export function PlatformPushForm({ initial, eventKeys }: PlatformPushFormProps) {
  const [pending, start] = useTransition();
  const [pubKey, setPubKey] = useState<string | null>(initial.vapid_public_key);
  const [subject, setSubject] = useState(initial.vapid_subject);
  const [allowed, setAllowed] = useState<Set<string>>(new Set(initial.allowed_event_keys));
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function rotate() {
    if (!confirm("Weet je het zeker? Bestaande abonnementen worden ongeldig.")) return;
    setMsg(null);
    start(async () => {
      const res = await generateVapidKeys();
      if (!res.ok) return setMsg(res.error);
      setPubKey(res.data.publicKey);
      setMsg("VAPID-sleutels gegenereerd.");
    });
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await savePlatformPushSettings({
        vapid_subject: subject,
        allowed_event_keys: Array.from(allowed),
      });
      if (!res.ok) return setMsg(res.error);
      setMsg("Opgeslagen.");
    });
  }

  function toggle(k: string) {
    const next = new Set(allowed);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setAllowed(next);
  }

  async function copy() {
    if (!pubKey) return;
    await navigator.clipboard.writeText(pubKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          VAPID
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Web push requires a VAPID key pair. The private key never leaves the
          server. Rotating invalidates every existing subscription.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          <label className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
            Public key
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={pubKey ?? ""}
              placeholder="Niet gegenereerd"
              className="h-9 flex-1 rounded-lg border bg-transparent px-2 font-mono text-[11px]"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="button"
              onClick={copy}
              disabled={!pubKey}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs disabled:opacity-50"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Gekopieerd" : "Kopieer"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <label className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
            Subject (mailto: of https://)
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-9 rounded-lg border bg-transparent px-2 text-xs"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={rotate}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          >
            <KeyRound className="h-3.5 w-3.5" />
            {pubKey ? "Rotate" : "Generate VAPID keys"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            Save
          </button>
        </div>
      </section>

      <section
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Allowed event types
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Empty list = all events may push. Otherwise only ticked events are allowed
          regardless of tenant settings.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {eventKeys.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              No events seeded yet.
            </p>
          ) : (
            eventKeys.map((k) => (
              <label
                key={k}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={allowed.has(k)}
                  onChange={() => toggle(k)}
                />
                <span className="font-mono">{k}</span>
              </label>
            ))
          )}
        </div>
      </section>

      {msg && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {msg}
        </p>
      )}
    </div>
  );
}
