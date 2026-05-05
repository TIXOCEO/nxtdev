"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { updateProfileSport } from "@/lib/actions/public/profile";

export interface SportMemberVM {
  id: string;
  player_type: string | null;
}

export function SportTab({
  tenantId,
  member,
  athleteCode,
}: {
  tenantId: string;
  member: SportMemberVM;
  athleteCode: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [playerType, setPlayerType] = useState<string>(member.player_type ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!athleteCode || typeof navigator === "undefined") return;
    navigator.clipboard
      .writeText(athleteCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        /* ignore */
      });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await updateProfileSport({
        tenant_id: tenantId,
        member_id: member.id,
        player_type: playerType as "player" | "goalkeeper" | "",
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Sportgegevens opgeslagen." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Sportprofiel
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Type speler
            <select
              value={playerType}
              onChange={(e) => setPlayerType(e.target.value)}
              className="mt-1 block h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
                backgroundColor: "var(--surface-soft)",
              }}
            >
              <option value="">—</option>
              <option value="player">Veldspeler</option>
              <option value="goalkeeper">Keeper</option>
            </select>
          </label>

          {athleteCode && (
            <div className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Persoonlijke code
              <div
                className="mt-1 flex h-10 items-center justify-between rounded-xl border px-3 text-sm font-mono"
                style={{
                  borderColor: "var(--surface-border)",
                  backgroundColor: "var(--surface-soft)",
                  color: "var(--text-primary)",
                }}
              >
                <span>{athleteCode}</span>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: "var(--tenant-accent)" }}
                  aria-label="Kopieer code"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Gekopieerd" : "Kopieer"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {msg && (
          <span className={msg.kind === "ok" ? "text-sm text-emerald-600" : "text-sm text-red-600"}>
            {msg.text}
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "#b6d83b", color: "#111" }}
        >
          {pending ? "Bezig…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
