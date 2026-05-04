"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { addPlatformAdminByEmail } from "@/lib/actions/platform/admins";

export function AddAdminForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Vul een e-mailadres in.");
      return;
    }
    startTransition(async () => {
      const res = await addPlatformAdminByEmail({ email: trimmed });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(`${trimmed} is toegevoegd als platformbeheerder.`);
      setEmail("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      <div className="flex-1">
        <label htmlFor="admin-email" className="sr-only">
          E-mailadres
        </label>
        <input
          id="admin-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="naam@voorbeeld.nl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className="h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none focus:ring-2"
          style={{
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        />
        {error && (
          <p className="mt-2 text-xs" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        )}
        {success && (
          <p className="mt-2 text-xs" style={{ color: "#15803d" }}>
            {success}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        Toevoegen
      </button>
    </form>
  );
}
