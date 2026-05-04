"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check, X } from "lucide-react";
import { subscribePush, unsubscribePush } from "@/lib/actions/public/push";

const DISMISS_KEY = "nxt-push-dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface PushPermissionCardProps {
  tenantId: string;
  vapidPublicKey: string | null;
}

type Status =
  | "loading"
  | "unsupported"
  | "denied"
  | "subscribed"
  | "available"
  | "dismissed";

/**
 * Sprint 13 — soft prompt to enable browser push notifications. We only
 * show the card when push is supported, not yet granted, and the user
 * hasn't dismissed in this browser.
 */
export function PushPermissionCard({ tenantId, vapidPublicKey }: PushPermissionCardProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      typeof Notification === "undefined"
    ) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    if (localStorage.getItem(DISMISS_KEY) === "1") {
      setStatus("dismissed");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "subscribed" : "available"))
      .catch(() => setStatus("available"));
  }, []);

  async function enable() {
    if (!vapidPublicKey) {
      setErr("Push is nog niet geconfigureerd door beheerder.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const keyArr = urlBase64ToUint8Array(vapidPublicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArr.buffer.slice(
          keyArr.byteOffset,
          keyArr.byteOffset + keyArr.byteLength,
        ) as ArrayBuffer,
      });
      const json = sub.toJSON();
      const res = await subscribePush({
        tenant_id: tenantId,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        user_agent: navigator.userAgent,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setStatus("subscribed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Inschakelen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setStatus("available");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    if (typeof window !== "undefined") localStorage.setItem(DISMISS_KEY, "1");
    setStatus("dismissed");
  }

  if (status === "loading" || status === "unsupported" || status === "dismissed") {
    return null;
  }

  if (status === "subscribed") {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-2xl border p-3"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" style={{ color: "var(--tenant-accent)" }} />
          <p className="text-xs" style={{ color: "var(--text-primary)" }}>
            Pushmeldingen actief op dit apparaat.
          </p>
        </div>
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
        >
          <BellOff className="inline h-3 w-3" /> Uit
        </button>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div
        className="rounded-2xl border p-3 text-xs"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
          color: "var(--text-secondary)",
        }}
      >
        Pushmeldingen zijn geblokkeerd in je browserinstellingen.
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="flex items-start gap-2">
        <Bell className="mt-0.5 h-4 w-4" style={{ color: "var(--tenant-accent)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Schakel pushmeldingen in
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Ontvang trainings- en clubmeldingen direct op dit apparaat.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--tenant-accent)", color: "var(--text-primary)" }}
        >
          {busy ? "Bezig…" : "Inschakelen"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg border px-2 py-1.5 text-xs"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
          aria-label="Niet nu"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
