"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMemberObservationAsTrainer } from "@/lib/actions/public/training-trainer";
import type { NoteVisibility } from "@/lib/validation/trainings";

interface Props {
  tenantId: string;
  memberId: string;
  sessionId: string | null;
}

export function ObservationForm({ tenantId, memberId, sessionId }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("private");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    if (body.trim().length < 2) {
      setErr("Notitie is verplicht.");
      return;
    }
    setErr(null);
    startTransition(async () => {
      const res = await createMemberObservationAsTrainer({
        tenant_id: tenantId,
        member_id: memberId,
        session_id: sessionId ?? null,
        body,
        visibility,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setBody("");
      setVisibility("private");
      router.refresh();
    });
  }

  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <label className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Nieuwe notitie {sessionId && "(gekoppeld aan training)"}
      </label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Wat viel je op?"
        className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm"
        style={{
          borderColor: "var(--surface-border)",
          color: "var(--text-primary)",
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => setVisibility("private")}
          className="rounded-md border px-2 py-1"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: visibility === "private" ? "var(--accent)" : "transparent",
            color: "var(--text-primary)",
          }}
        >
          Privé
        </button>
        <button
          type="button"
          onClick={() => setVisibility("member")}
          className="rounded-md border px-2 py-1"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: visibility === "member" ? "var(--accent)" : "transparent",
            color: "var(--text-primary)",
          }}
        >
          Zichtbaar voor lid
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--text-primary)",
          }}
        >
          Opslaan
        </button>
      </div>
      {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
    </div>
  );
}
