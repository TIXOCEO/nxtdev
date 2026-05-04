"use client";

import { useEffect, useState } from "react";

export function ProfileClientStatus({ kind }: { kind: "push" | "install" }) {
  const [status, setStatus] = useState<string>("…");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (kind === "install") {
      const installed =
        window.matchMedia("(display-mode: standalone)").matches ||
        // iOS safari
        // @ts-expect-error legacy property
        window.navigator.standalone === true;
      setStatus(installed ? "Geïnstalleerd op dit apparaat" : "Niet geïnstalleerd");
      return;
    }
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
      setStatus("Niet ondersteund door deze browser");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("Geblokkeerd in browserinstellingen");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) =>
        setStatus(sub ? "Actief op dit apparaat" : "Niet ingeschakeld"),
      )
      .catch(() => setStatus("Niet ingeschakeld"));
  }, [kind]);

  return (
    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
      {status}
    </p>
  );
}
