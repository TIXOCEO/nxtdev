"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type State = "working" | "error";

// Module-level guard: voorkomt dat een dubbele mount (Next 15 / React
// concurrent rendering / Suspense re-mount) twee gelijktijdige
// setSession-calls afvuurt — die racen om dezelfde Supabase auth-lock
// en geven "Lock was released because another request stole it".
let didStart = false;

export function AuthCallbackClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<State>("working");
  const [message, setMessage] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || didStart) return;
    startedRef.current = true;
    didStart = true;
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

        // De browser-client heeft `detectSessionInUrl: true` (default) en
        // parseert tokens uit de URL automatisch tijdens instantiatie.
        // Onze taak: wachten tot de sessie is opgeslagen, dan doorsturen.
        const supabase = createClient();

        // Wacht eerst op een SIGNED_IN event (race-vrij). Als die binnen
        // 5s niet komt, val terug op een polling-getSession (voor het
        // geval detectSessionInUrl al klaar was vóór de listener stond).
        const session = await new Promise<{ ok: true } | { ok: false; error: string }>(
          (resolve) => {
            let settled = false;
            const finish = (r: { ok: true } | { ok: false; error: string }) => {
              if (settled) return;
              settled = true;
              resolve(r);
            };

            const { data: sub } = supabase.auth.onAuthStateChange((event) => {
              if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
                supabase.auth.getSession().then(({ data }) => {
                  if (data.session) {
                    sub.subscription.unsubscribe();
                    finish({ ok: true });
                  }
                });
              }
            });

            // Poll-fallback (max 6s) — vangt het geval waarin
            // detectSessionInUrl al klaar was vóór onze listener.
            let attempts = 0;
            const poll = window.setInterval(async () => {
              attempts += 1;
              const { data } = await supabase.auth.getSession();
              if (data.session) {
                window.clearInterval(poll);
                sub.subscription.unsubscribe();
                finish({ ok: true });
              } else if (attempts >= 12) {
                window.clearInterval(poll);
                sub.subscription.unsubscribe();
                finish({ ok: false, error: "Sessie kon niet worden opgeslagen." });
              }
            }, 500);
          },
        );

        window.clearTimeout(watchdog);
        if (!session.ok) {
          if (!cancelled) {
            setState("error");
            setMessage(session.error);
          }
          return;
        }

        // Schoon de fragment weg uit de URL voordat we doorsturen.
        window.history.replaceState(null, "", window.location.pathname);
        // Hard navigate naar de Route Handler die cookies set + redirect.
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
