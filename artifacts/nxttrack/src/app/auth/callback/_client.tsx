"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type State = "working" | "error";

export function AuthCallbackClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<State>("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Watchdog: als er na 8s nog niets gebeurd is, laat een error zien
    // i.p.v. eindeloos spinnen (bv. wanneer Supabase magic-link uit staat
    // en er geen tokens of error in fragment terechtkomen).
    const watchdog = window.setTimeout(() => {
      if (!cancelled) {
        setState("error");
        setMessage(
          "Geen reactie van Supabase. Controleer of 'Magic Link' onder Auth → Providers → Email aanstaat, en dat https://nxttrack.nl/auth/callback in de Redirect URLs staat.",
        );
      }
    }, 8000);
    async function run() {
      try {
        const next = params.get("next");
        const safeNext = next && next.startsWith("/") ? next : "/tenant";

        // Supabase kan errors zowel in de querystring als in de fragment
        // zetten — afhankelijk van de auth-flow van het project.
        const queryError =
          params.get("error_description") ?? params.get("error");
        if (queryError) {
          if (!cancelled) {
            window.clearTimeout(watchdog);
            setState("error");
            setMessage(queryError);
          }
          return;
        }

        const hashRaw = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const fragment = new URLSearchParams(hashRaw);
        const fragmentError =
          fragment.get("error_description") ?? fragment.get("error");
        if (fragmentError) {
          if (!cancelled) {
            window.clearTimeout(watchdog);
            setState("error");
            setMessage(fragmentError);
          }
          return;
        }

        const supabase = createClient();

        // Drie ondersteunde varianten:
        // 1. PKCE / code flow: `?code=<authcode>`
        // 2. Query-style implicit: `?access_token=...&refresh_token=...`
        // 3. Hash-style implicit:  `#access_token=...&refresh_token=...`
        const code = params.get("code");
        const accessToken =
          fragment.get("access_token") ?? params.get("access_token");
        const refreshToken =
          fragment.get("refresh_token") ?? params.get("refresh_token");

        let setSessionError: { message: string } | null = null;
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          setSessionError = error ? { message: error.message } : null;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          setSessionError = error ? { message: error.message } : null;
        } else {
          if (!cancelled) {
            window.clearTimeout(watchdog);
            setState("error");
            setMessage(
              "Geen sessie-tokens ontvangen. Controleer in Supabase dat https://nxttrack.nl/auth/callback in de Redirect URLs staat.",
            );
          }
          return;
        }

        const error = setSessionError;
        window.clearTimeout(watchdog);
        if (error) {
          if (!cancelled) {
            setState("error");
            setMessage(error.message);
          }
          return;
        }

        // Schoon de fragment weg uit de URL voordat we doorsturen.
        window.history.replaceState(null, "", window.location.pathname);
        // Gebruik hard navigate i.p.v. router.push omdat de doelroute
        // (`/tenant/switch`) een Route Handler is die cookies set en
        // direct redirect — Next router cachet daar minder netjes mee.
        window.location.replace(safeNext);
      } catch (e) {
        window.clearTimeout(watchdog);
        if (!cancelled) {
          setState("error");
          setMessage(e instanceof Error ? e.message : "Onbekende fout.");
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
    };
  }, [params, router]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{
        background:
          "linear-gradient(135deg, var(--bg-viewport-start), var(--bg-viewport-end))",
      }}
    >
      <div
        className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl p-8 text-center"
        style={{
          backgroundColor: "var(--bg-app)",
          boxShadow: "0 8px 40px var(--shadow-color)",
        }}
      >
        {state === "working" ? (
          <>
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Bezig met inloggen…
            </p>
          </>
        ) : (
          <>
            <AlertCircle className="h-6 w-6" style={{ color: "#b91c1c" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Inloggen mislukt
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {message || "Probeer het opnieuw."}
            </p>
            <a
              href="/login"
              className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              Naar inlogpagina
            </a>
          </>
        )}
      </div>
    </div>
  );
}
