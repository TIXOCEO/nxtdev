"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogIn } from "lucide-react";
import { acceptMinorLinkInvite } from "@/lib/actions/tenant/invites";

export interface AcceptMinorLinkFormProps {
  token: string;
  tenantSlug: string;
  childName: string | null;
  accentColor: string;
}

export function AcceptMinorLinkForm({
  token,
  tenantSlug,
  childName,
  accentColor,
}: AcceptMinorLinkFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setErr(null);
    startTransition(async () => {
      const res = await acceptMinorLinkInvite({ token });
      if (!res.ok) {
        // Most common reason: not logged in.
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
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          {childName ? `${childName} is aan je account gekoppeld.` : "Het kind is gekoppeld."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-center">
      <p className="text-sm" style={{ color: "var(--text-primary)" }}>
        Je bent uitgenodigd om{" "}
        <strong>{childName ?? "een kind"}</strong> aan je ouder-account te
        koppelen.
      </p>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Log eerst in (of maak een account aan), klik daarna op koppelen.
      </p>
      <div className="flex flex-col gap-2">
        <a
          href={`/login?redirect=${encodeURIComponent(`/t/${tenantSlug}/invite/${token}`)}`}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border bg-transparent px-4 text-sm font-medium"
          style={{
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        >
          <LogIn className="h-4 w-4" /> Inloggen
        </a>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: accentColor, color: "#fff" }}
        >
          {pending ? "Bezig…" : "Kind koppelen"}
        </button>
      </div>
      {err && (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
