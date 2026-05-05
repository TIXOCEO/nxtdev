"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ensureProfileForCurrentUser } from "@/lib/actions/auth";

type State = "idle" | "loading" | "error";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "";

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

    const sync = await ensureProfileForCurrentUser(next || undefined);
    if (!sync.ok) {
      setState("error");
      setErrorMessage(sync.error ?? "Failed to sync profile.");
      return;
    }

    router.push(sync.destination ?? next ?? "/");
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{
        background: "linear-gradient(135deg, var(--bg-viewport-start), var(--bg-viewport-end))",
      }}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-7 rounded-2xl p-8"
        style={{
          backgroundColor: "var(--bg-app)",
          boxShadow: "0 8px 40px var(--shadow-color)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <Zap className="h-6 w-6" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="text-center">
            <p
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              NXTTRACK
            </p>
            <h1 className="mt-0.5 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Sign in
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Email address
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--text-secondary)" }}
              />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border py-2.5 pl-9 pr-4 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: "var(--surface-soft)",
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--surface-border)"; }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Password
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--text-secondary)" }}
              />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border py-2.5 pl-9 pr-4 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: "var(--surface-soft)",
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--surface-border)"; }}
              />
            </div>
          </div>

          {state === "error" && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
              style={{ backgroundColor: "#fef2f2", color: "#b91c1c" }}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {errorMessage || "Something went wrong. Please try again."}
            </div>
          )}

          <button
            type="submit"
            disabled={state === "loading" || !email.trim() || !password}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            {state === "loading" ? (
              "Signing in…"
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Accounts are created by an administrator.
        </p>
      </div>
    </div>
  );
}
