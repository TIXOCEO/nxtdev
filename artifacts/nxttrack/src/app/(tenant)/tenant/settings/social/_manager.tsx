"use client";

import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";
import { SOCIAL_PLATFORMS } from "@/lib/social/catalog";
import { SocialIcon } from "@/components/public/social-icon";
import { upsertSocialLink } from "@/lib/actions/tenant/social-links";

interface ExistingRow {
  platform: string;
  url: string;
  is_active: boolean;
  sort_order: number;
}

interface RowState {
  url: string;
  is_active: boolean;
  sort_order: number;
  dirty: boolean;
  saving: boolean;
  error: string | null;
}

export function SocialLinksManager({
  tenantId,
  existing,
}: {
  tenantId: string;
  existing: ExistingRow[];
}) {
  const initial = useMemo(() => {
    const map: Record<string, RowState> = {};
    for (const p of SOCIAL_PLATFORMS) {
      const ex = existing.find((e) => e.platform === p.key);
      map[p.key] = {
        url: ex?.url ?? "",
        is_active: ex?.is_active ?? false,
        sort_order: ex?.sort_order ?? 0,
        dirty: false,
        saving: false,
        error: null,
      };
    }
    return map;
  }, [existing]);

  const [rows, setRows] = useState<Record<string, RowState>>(initial);
  const [, start] = useTransition();
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);

  function update(key: string, patch: Partial<RowState>) {
    setRows((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, ...patch, dirty: true },
    }));
  }

  function save(key: string) {
    const r = rows[key]!;
    setRows((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, saving: true, error: null },
    }));
    setGlobalMsg(null);
    start(async () => {
      const res = await upsertSocialLink({
        tenant_id: tenantId,
        platform: key,
        url: r.url,
        is_active: r.is_active,
        sort_order: r.sort_order,
      });
      setRows((prev) => ({
        ...prev,
        [key]: {
          ...prev[key]!,
          saving: false,
          dirty: !res.ok,
          error: res.ok ? null : res.error,
        },
      }));
      if (res.ok) setGlobalMsg("Opgeslagen.");
    });
  }

  return (
    <div className="space-y-3">
      {globalMsg && (
        <div
          className="rounded-xl border px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-secondary)",
          }}
        >
          {globalMsg}
        </div>
      )}
      <ul
        className="overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        {SOCIAL_PLATFORMS.map((p) => {
          const r = rows[p.key]!;
          return (
            <li
              key={p.key}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b px-3 py-3 last:border-b-0"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: r.is_active && r.url ? "var(--accent)" : "var(--surface-soft)",
                  color: "var(--text-primary)",
                  opacity: r.is_active && r.url ? 1 : 0.55,
                }}
              >
                <SocialIcon platform={p.key} size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {p.label}
                </p>
                <input
                  value={r.url}
                  onChange={(e) => update(p.key, { url: e.target.value })}
                  placeholder={p.hint}
                  className="mt-1 w-full rounded-lg border px-2 py-1 text-xs outline-none"
                  style={{
                    backgroundColor: "var(--surface-soft)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                  }}
                />
                {r.error && (
                  <p className="mt-1 text-[11px]" style={{ color: "#b91c1c" }}>
                    {r.error}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => update(p.key, { is_active: !r.is_active })}
                className="rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: r.is_active ? "var(--accent)" : "var(--surface-soft)",
                  color: r.is_active ? "var(--text-primary)" : "var(--text-secondary)",
                }}
                title={r.is_active ? "Actief" : "Niet actief"}
              >
                {r.is_active ? "Actief" : "Uit"}
              </button>
              <button
                type="button"
                onClick={() => save(p.key)}
                disabled={!r.dirty || r.saving}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40"
                style={{
                  backgroundColor: r.dirty ? "var(--accent)" : "transparent",
                  color: "var(--text-primary)",
                  border: r.dirty ? "none" : "1px solid var(--surface-border)",
                }}
              >
                <Save className="h-3 w-3" />
                {r.saving ? "Opslaan…" : "Opslaan"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
