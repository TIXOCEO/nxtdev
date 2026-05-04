"use client";

import { useState, useTransition } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { setUserThemePreference } from "@/lib/actions/public/theme-pref";

export interface ThemeModePickerProps {
  tenantId: string;
  slug: string;
  initialMode: "auto" | "light" | "dark";
}

function setCookie(name: string, value: string, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
}

export function ThemeModePicker({ tenantId, slug, initialMode }: ThemeModePickerProps) {
  const [mode, setMode] = useState<"auto" | "light" | "dark">(initialMode);
  const [pending, start] = useTransition();
  const cookieName = `nxt-mode-${slug}`;

  function pick(next: "auto" | "light" | "dark") {
    setMode(next);
    setCookie(cookieName, next);
    start(async () => {
      await setUserThemePreference({
        tenant_id: tenantId,
        slug,
        mode_preference: next,
      });
      // Reload to apply immediately.
      window.location.reload();
    });
  }

  const options: { value: "auto" | "light" | "dark"; label: string; Icon: typeof Sun }[] = [
    { value: "auto", label: "Systeem", Icon: Monitor },
    { value: "light", label: "Licht", Icon: Sun },
    { value: "dark", label: "Donker", Icon: Moon },
  ];

  return (
    <div
      className="inline-flex rounded-xl border p-1"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-soft)",
      }}
    >
      {options.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            disabled={pending}
            onClick={() => pick(value)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
            style={{
              backgroundColor: active ? "var(--surface-main)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: active ? "0 1px 2px var(--shadow-color)" : undefined,
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
