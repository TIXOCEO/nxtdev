"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { setThemeActiveForTenant } from "@/lib/actions/tenant/themes";

interface ThemeVM {
  id: string;
  scope: "platform" | "tenant";
  name: string;
  mode: "light" | "dark";
  tokens: Record<string, string>;
  is_default: boolean;
  enabled: boolean;
}

interface Props {
  tenantId: string;
  themes: ThemeVM[];
}

export function TenantThemesForm({ tenantId, themes: initial }: Props) {
  const [themes, setThemes] = useState<ThemeVM[]>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(id: string, value: boolean) {
    setThemes((cur) => cur.map((t) => (t.id === id ? { ...t, enabled: value } : t)));
    setMsg(null);
    start(async () => {
      const res = await setThemeActiveForTenant({
        tenant_id: tenantId,
        theme_id: id,
        enabled: value,
      });
      if (!res.ok) {
        setMsg(res.error);
        // revert
        setThemes((cur) =>
          cur.map((t) => (t.id === id ? { ...t, enabled: !value } : t)),
        );
      }
    });
  }

  const light = themes.filter((t) => t.mode === "light");
  const dark = themes.filter((t) => t.mode === "dark");

  return (
    <div className="space-y-5">
      {msg && (
        <div
          className="rounded-xl border px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-secondary)",
          }}
        >
          {msg}
        </div>
      )}

      <Group title="Light mode" themes={light} onToggle={toggle} pending={pending} />
      <Group title="Dark mode" themes={dark} onToggle={toggle} pending={pending} />
    </div>
  );
}

function Group({
  title,
  themes,
  onToggle,
  pending,
}: {
  title: string;
  themes: ThemeVM[];
  onToggle: (id: string, value: boolean) => void;
  pending: boolean;
}) {
  if (themes.length === 0) {
    return (
      <section
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen thema's beschikbaar voor deze mode.
        </p>
      </section>
    );
  }
  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {themes.map((t) => {
          const accent = t.tokens["--accent"] ?? "#b6d83b";
          const bg = t.tokens["--bg-app"] ?? "#fff";
          const text = t.tokens["--text-primary"] ?? "#000";
          return (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-xs font-bold"
                style={{
                  backgroundColor: bg,
                  borderColor: "var(--surface-border)",
                  color: text,
                }}
              >
                <span style={{ color: accent }}>Aa</span>
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="flex items-center gap-1 truncate text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t.name}
                  {t.is_default && (
                    <Star className="h-3 w-3" style={{ color: accent }} />
                  )}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {t.scope === "platform" ? "Platform" : "Eigen thema"}
                </p>
              </div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={t.enabled}
                  disabled={pending}
                  onChange={(e) => onToggle(t.id, e.target.checked)}
                />
                <span style={{ color: "var(--text-secondary)" }}>
                  {t.enabled ? "Aan" : "Uit"}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
