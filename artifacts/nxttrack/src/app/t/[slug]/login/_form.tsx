"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureProfileForCurrentUser } from "@/lib/actions/auth";

type State = "idle" | "loading" | "error";

export interface TenantLoginFormProps {
  slug: string;
}

export function TenantLoginForm({ slug }: TenantLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || `/t/${slug}`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setState("loading");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setState("error");
      setErrorMessage(error.message);
      return;
    }
    const sync = await ensureProfileForCurrentUser();
    if (!sync.ok) {
      setState("error");
      setErrorMessage(sync.error ?? "Profielsynchronisatie mislukt.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="t-email"
          className="text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          E-mailadres
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--text-secondary)" }}
          />
          <input
            id="t-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border py-2.5 pl-9 pr-4 text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-soft)",
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="t-password"
          className="text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Wachtwoord
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--text-secondary)" }}
          />
          <input
            id="t-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border py-2.5 pl-9 pr-4 text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-soft)",
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {state === "error" && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
          style={{ backgroundColor: "#fef2f2", color: "#b91c1c" }}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {errorMessage || "Er ging iets mis."}
        </div>
      )}

      <button
        type="submit"
        disabled={state === "loading" || !email.trim() || !password}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          backgroundColor: "var(--tenant-accent)",
          color: "var(--text-primary)",
        }}
      >
        {state === "loading" ? "Bezig…" : (
          <>
            Inloggen
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
