"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users } from "lucide-react";
import { linkMinorByCode } from "@/lib/actions/tenant/invites";

export interface ChildVM {
  id: string;
  full_name: string;
}

export interface FamilySectionProps {
  tenantId: string;
  children: ChildVM[];
}

export function FamilySection({ tenantId, children }: FamilySectionProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setMsg({ kind: "err", text: "Voer een geldige koppelcode in." });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await linkMinorByCode({
        tenant_id: tenantId,
        invite_code: trimmed,
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Kind succesvol gekoppeld aan je account." });
      setCode("");
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-2xl border p-4 sm:p-5"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <header className="mb-3 flex items-center gap-2">
        <Users className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Mijn gezin
        </h2>
      </header>

      {children.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Je hebt nog geen kinderen gekoppeld.
        </p>
      ) : (
        <ul className="mb-4 space-y-1.5">
          {children.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            >
              <span>{c.full_name}</span>
              <span
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Gekoppeld
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="space-y-2">
        <label
          htmlFor="link-code"
          className="block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Voeg een kind toe via koppelcode
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="link-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Bijv. AB12-CD34"
            className="h-10 flex-1 rounded-xl border bg-transparent px-3 text-sm font-mono uppercase tracking-wider outline-none"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-soft)",
            }}
            disabled={pending}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={pending || code.trim().length < 4}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#b6d83b", color: "#111" }}
          >
            <UserPlus className="h-4 w-4" />
            {pending ? "Bezig…" : "Koppel kind"}
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Je kreeg deze code per e-mail van de club. De code is hoofdletter-ongevoelig.
        </p>
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
      </form>
    </section>
  );
}
