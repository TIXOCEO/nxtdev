"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogIn } from "lucide-react";
import { linkMinorByCode } from "@/lib/actions/tenant/invites";

export interface LinkMinorByCodeFormProps {
  tenantId: string;
  tenantSlug: string;
  accentColor: string;
}

const inputCls =
  "h-12 w-full rounded-xl border bg-transparent px-3 text-center text-base font-mono uppercase tracking-widest outline-none disabled:opacity-50";

export function LinkMinorByCodeForm({
  tenantId,
  tenantSlug,
  accentColor,
}: LinkMinorByCodeFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!code.trim()) {
      setErr("Vul een code in.");
      return;
    }
    startTransition(async () => {
      const res = await linkMinorByCode({
        tenant_id: tenantId,
        invite_code: code,
      });
      if (!res.ok) {
        if (/redirect|auth|login|forbidden/i.test(res.error)) {
          setErr("Je moet eerst inloggen om je kind te koppelen.");
        } else {
          setErr(res.error);
        }
        return;
      }
      setDone(true);
      setTimeout(() => router.push(`/t/${tenantSlug}`), 1500);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-8 w-8" style={{ color: accentColor }} />
        <h2
          className="mt-2 text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Gekoppeld
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Je kind is aan je account gekoppeld.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="XXX-XXXX"
        autoFocus
        className={inputCls}
        style={{
          borderColor: "var(--surface-border)",
          color: "var(--text-primary)",
        }}
      />

      {err && (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: accentColor, color: "#fff" }}
      >
        {pending ? "Bezig…" : "Koppelen"}
      </button>

      <a
        href={`/login?redirect=${encodeURIComponent(`/t/${tenantSlug}/koppel-kind`)}`}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border bg-transparent px-4 text-sm"
        style={{
          borderColor: "var(--surface-border)",
          color: "var(--text-secondary)",
        }}
      >
        <LogIn className="h-4 w-4" /> Niet ingelogd? Log eerst in.
      </a>
    </form>
  );
}
