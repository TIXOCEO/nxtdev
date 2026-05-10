"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateIntakeSettings } from "@/lib/actions/tenant/intake-settings";

type Mode = "registration" | "waitlist";
type OverrideMode = Mode | "default";

const TARGETS: Array<{ key: string; label: string }> = [
  { key: "child", label: "Aanmelding voor een kind" },
  { key: "self", label: "Aanmelding voor zichzelf" },
];

export interface IntakeSettingsFormProps {
  tenantId: string;
  initial: {
    intake_default: Mode;
    overrides: Record<string, Mode>;
    /** Sprint 64 — Sleutel = `programs.public_slug`. */
    programOverrides: Record<string, Mode>;
  };
  /** Sprint 64 — Alleen publieke programma's (deeplink-relevant). */
  programs: Array<{
    public_slug: string;
    name: string;
    marketing_title: string | null;
  }>;
}

export function IntakeSettingsForm({
  tenantId,
  initial,
  programs,
}: IntakeSettingsFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [def, setDef] = useState<Mode>(initial.intake_default);
  const [over, setOver] = useState<Record<string, OverrideMode>>(() => {
    const out: Record<string, OverrideMode> = {};
    for (const t of TARGETS) out[t.key] = initial.overrides[t.key] ?? "default";
    return out;
  });
  const [progOver, setProgOver] = useState<Record<string, OverrideMode>>(() => {
    const out: Record<string, OverrideMode> = {};
    for (const p of programs) {
      out[p.public_slug] = initial.programOverrides[p.public_slug] ?? "default";
    }
    return out;
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    start(async () => {
      const targetPayload: Record<string, OverrideMode> = {};
      for (const [k, v] of Object.entries(over)) {
        if (v === "registration" || v === "waitlist") targetPayload[k] = v;
      }
      const programPayload: Record<string, OverrideMode> = {};
      for (const [k, v] of Object.entries(progOver)) {
        if (v === "registration" || v === "waitlist") programPayload[k] = v;
      }
      const res = await updateIntakeSettings({
        tenant_id: tenantId,
        intake_default: def,
        intake_overrides_by_target: targetPayload,
        intake_overrides_by_program: programPayload,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg("Opgeslagen.");
      router.refresh();
    });
  }

  const cardStyle = {
    borderColor: "var(--surface-border)",
    backgroundColor: "var(--surface-bg, transparent)",
  } as const;
  const labelStyle = { color: "var(--text-secondary)" } as const;

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Standaard-routing
        </legend>
        <p className="text-xs" style={labelStyle}>
          Bepaalt waar elke nieuwe publieke aanmelding standaard naartoe gaat.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["registration", "waitlist"] as Mode[]).map((m) => (
            <label
              key={m}
              className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm"
              style={cardStyle}
            >
              <input
                type="radio"
                name="intake_default"
                value={m}
                checked={def === m}
                onChange={() => setDef(m)}
                disabled={pending}
                className="mt-1"
              />
              <span>
                <span className="block font-medium" style={{ color: "var(--text-primary)" }}>
                  {m === "registration" ? "Inschrijving" : "Wachtlijst"}
                </span>
                <span className="block text-xs" style={labelStyle}>
                  {m === "registration"
                    ? "Aanmelding komt direct in het inschrijvingen-overzicht."
                    : "Aanmelding komt op de wachtlijst en kan later aangeboden worden."}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Uitzonderingen per doelgroep (optioneel)
        </legend>
        <p className="text-xs" style={labelStyle}>
          Wijk per doelgroep af van de standaard-routing.
        </p>
        <div className="space-y-2">
          {TARGETS.map((t) => (
            <div
              key={t.key}
              className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
              style={cardStyle}
            >
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                {t.label}
              </span>
              <select
                value={over[t.key] ?? "default"}
                onChange={(e) =>
                  setOver((s) => ({ ...s, [t.key]: e.target.value as OverrideMode }))
                }
                disabled={pending}
                className="h-9 rounded-xl border bg-transparent px-2 text-sm"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--surface-main)",
                }}
              >
                <option value="default">Volg standaard</option>
                <option value="registration">Altijd inschrijving</option>
                <option value="waitlist">Altijd wachtlijst</option>
              </select>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Per programma overrides (optioneel)
        </legend>
        <p className="text-xs" style={labelStyle}>
          Wint van de doelgroep-uitzondering wanneer een aanmelding via een
          publieke programma-link binnenkomt (?program=&lt;slug&gt;). Alleen
          publieke programma&apos;s zijn hieronder zichtbaar.
        </p>
        {programs.length === 0 ? (
          <p
            className="rounded-xl border p-3 text-xs"
            style={{
              ...cardStyle,
              color: "var(--text-secondary)",
            }}
          >
            Er zijn nog geen publieke programma&apos;s voor deze vereniging.
          </p>
        ) : (
          <div className="space-y-2">
            {programs.map((p) => (
              <div
                key={p.public_slug}
                className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                style={cardStyle}
              >
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.marketing_title || p.name}
                  </p>
                  <p
                    className="truncate text-[11px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    /programmas/{p.public_slug}
                  </p>
                </div>
                <select
                  value={progOver[p.public_slug] ?? "default"}
                  onChange={(e) =>
                    setProgOver((s) => ({
                      ...s,
                      [p.public_slug]: e.target.value as OverrideMode,
                    }))
                  }
                  disabled={pending}
                  className="h-9 rounded-xl border bg-transparent px-2 text-sm"
                  style={{
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                    backgroundColor: "var(--surface-main)",
                  }}
                >
                  <option value="default">Volg standaard / doelgroep</option>
                  <option value="registration">Altijd inschrijving</option>
                  <option value="waitlist">Altijd wachtlijst</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Opslaan..." : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
