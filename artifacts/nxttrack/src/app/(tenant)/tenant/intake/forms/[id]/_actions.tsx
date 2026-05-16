"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  publishIntakeForm,
  archiveIntakeForm,
  setDefaultIntakeForm,
  duplicateIntakeForm,
} from "@/lib/actions/tenant/intake-forms";

export function IntakeFormDetailActions({
  tenantId,
  formId,
  status,
  isDefault,
}: {
  tenantId: string;
  formId: string;
  status: "draft" | "published" | "archived";
  isDefault: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Actie mislukt.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" ? (
        !confirmPublish ? (
          <button
            type="button"
            onClick={() => setConfirmPublish(true)}
            className="rounded-md px-3 py-1.5 text-sm font-medium"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-foreground, white)",
            }}
          >
            Publiceer
          </button>
        ) : (
          <div
            className="flex items-center gap-2 rounded-md p-2 text-sm"
            style={{ border: "1px solid var(--border)" }}
          >
            <span>Zeker weten?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => publishIntakeForm({ tenant_id: tenantId, form_id: formId }))
              }
              className="rounded-md px-2 py-1 text-xs font-medium"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              Ja, publiceer
            </button>
            <button
              type="button"
              onClick={() => setConfirmPublish(false)}
              className="text-xs underline"
            >
              Annuleren
            </button>
          </div>
        )
      ) : null}

      {status !== "archived" ? (
        !confirmArchive ? (
          <button
            type="button"
            onClick={() => setConfirmArchive(true)}
            className="rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)" }}
          >
            Archiveer
          </button>
        ) : (
          <div
            className="flex items-center gap-2 rounded-md p-2 text-sm"
            style={{ border: "1px solid var(--border)" }}
          >
            <span>Zeker weten?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => archiveIntakeForm({ tenant_id: tenantId, form_id: formId }))
              }
              className="rounded-md px-2 py-1 text-xs font-medium"
              style={{ backgroundColor: "#dc2626", color: "white" }}
            >
              Ja, archiveer
            </button>
            <button
              type="button"
              onClick={() => setConfirmArchive(false)}
              className="text-xs underline"
            >
              Annuleren
            </button>
          </div>
        )
      ) : null}

      {status === "published" && !isDefault ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => setDefaultIntakeForm({ tenant_id: tenantId, form_id: formId }))
          }
          className="rounded-md border px-3 py-1.5 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          Maak standaard
        </button>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() => duplicateIntakeForm({ tenant_id: tenantId, form_id: formId }))
        }
        className="rounded-md border px-3 py-1.5 text-sm"
        style={{ borderColor: "var(--border)" }}
      >
        Dupliceer
      </button>

      {error ? (
        <p className="w-full text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
