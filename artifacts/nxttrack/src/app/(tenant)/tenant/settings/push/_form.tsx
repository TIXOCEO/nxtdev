"use client";

import { useState, useTransition } from "react";
import { saveTenantPushSettings } from "@/lib/actions/tenant/push";

export interface TenantPushFormProps {
  tenantId: string;
  eventKeys: string[];
  initial: {
    push_enabled: boolean;
    default_push_on_manual: boolean;
    event_overrides: Record<string, boolean>;
  };
}

export function TenantPushForm({ tenantId, eventKeys, initial }: TenantPushFormProps) {
  const [pending, start] = useTransition();
  const [pushEnabled, setPushEnabled] = useState(initial.push_enabled);
  const [defaultManual, setDefaultManual] = useState(initial.default_push_on_manual);
  const [overrides, setOverrides] = useState<Record<string, boolean>>(
    initial.event_overrides,
  );
  const [msg, setMsg] = useState<string | null>(null);

  function getValue(k: string): boolean {
    return overrides[k] ?? true;
  }

  function toggle(k: string) {
    setOverrides({ ...overrides, [k]: !getValue(k) });
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveTenantPushSettings({
        tenant_id: tenantId,
        push_enabled: pushEnabled,
        default_push_on_manual: defaultManual,
        event_overrides: overrides,
      });
      setMsg(res.ok ? "Opgeslagen." : res.error);
    });
  }

  return (
    <div className="space-y-5">
      <Toggle
        label="Pushmeldingen actief voor deze club"
        description="Hoofdschakelaar; uit = nooit pushen, ongeacht overige instellingen."
        checked={pushEnabled}
        onChange={setPushEnabled}
      />
      <Toggle
        label="Push standaard aan voor handmatige meldingen"
        description="Bepaalt of het 'push' vinkje in het meldingenformulier standaard aan staat."
        checked={defaultManual}
        onChange={setDefaultManual}
      />

      <div>
        <h3 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          Per event
        </h3>
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Vink uit om push voor dat event te onderdrukken (e-mail blijft werken).
        </p>
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {eventKeys.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Geen events beschikbaar.
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
                  checked={getValue(k)}
                  onChange={() => toggle(k)}
                />
                <span className="font-mono">{k}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          {pending ? "Bezig…" : "Opslaan"}
        </button>
        {msg && (
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>
        <span
          className="block text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </span>
        <span
          className="mt-0.5 block text-[11px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </span>
      </span>
    </label>
  );
}
