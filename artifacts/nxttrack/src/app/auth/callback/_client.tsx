"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { applyAuthTokensAction } from "@/lib/actions/auth";

type State = "working" | "error";

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

    const watchdog = window.setTimeout(() => {
      if (!cancelled) {
        setState("error");
        setMessage(
          "Geen reactie van de server. Controleer je internet en probeer opnieuw.",
        );
      }
    }, 12000);

    async function run() {
      try {
        const next = params.get("next");
        const safeNext = next && next.startsWith("/") ? next : "/tenant";

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

        const code = params.get("code");
        const accessToken =
          fragment.get("access_token") ?? params.get("access_token");
        const refreshToken =
          fragment.get("refresh_token") ?? params.get("refresh_token");

        if (!code && !(accessToken && refreshToken)) {
          if (!cancelled) {
            window.clearTimeout(watchdog);
            setState("error");
            setMessage(
              "Geen sessie-tokens ontvangen. Controleer in Supabase dat https://nxttrack.nl/auth/callback in de Redirect URLs staat.",
            );
          }
          return;
        }

        // Strip de fragment direct uit de URL — voorkomt dat eventuele
        // andere browser-clients in de pagina hem alsnog proberen te
        // parsen en op de auth-lock crashen.
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );

        // Server-side de cookies wegschrijven. Geen browser-Supabase-client
        // meer betrokken op deze pagina, dus geen lock-race meer mogelijk.
        const result = await applyAuthTokensAction({
          accessToken,
          refreshToken,
          code,
        });

        window.clearTimeout(watchdog);
        if (!result.ok) {
          if (!cancelled) {
            setState("error");
            setMessage(result.error ?? "Sessie kon niet worden opgeslagen.");
          }
          return;
        }

        // Hard navigate naar de Route Handler die de active-tenant cookie
        // set en doorstuurt naar de juiste pagina.
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
          "linear-gradient(180deg, var(--bg-viewport-start, #f5f7fb) 0%, var(--bg-viewport-end, #eef1f5) 100%)",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
        {state === "working" ? (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-700" />
            <h1 className="text-base font-semibold text-gray-900">
              Bezig met inloggen...
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Een ogenblik geduld, je wordt automatisch doorgestuurd.
            </p>
          </>
        ) : (
          <>
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
            <h1 className="text-base font-semibold text-gray-900">
              Inloggen mislukt
            </h1>
            <p className="mt-2 text-xs text-gray-600">{message}</p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold"
              style={{
                backgroundColor: "var(--accent, #b6d83b)",
                color: "var(--text-primary, #111)",
              }}
            >
              Naar inlogpagina
            </button>
          </>
        )}
      </div>
    </div>
  );
}
