"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  assignSessionInstructor,
  unassignSessionInstructor,
} from "@/lib/actions/tenant/instructors";

interface ExplicitRow {
  id: string;
  member_id: string;
  full_name: string;
  assignment_type: "primary" | "assistant" | "substitute" | "observer";
  replaces_member_id: string | null;
  replaces_member_name: string | null;
}
interface EffectiveRow {
  member_id: string;
  full_name: string;
  assignment_type: "primary" | "assistant" | "substitute" | "observer";
  is_explicit: boolean;
}
interface EligibleRow {
  id: string;
  full_name: string;
}

export interface InstructorBlockLabels {
  /** instructor_singular, e.g. "Trainer" of "Zweminstructeur" */
  singular: string;
  /** instructor_plural, e.g. "Trainers" of "Zweminstructeurs" */
  plural: string;
}

export function SessionInstructorsBlock({
  tenantId,
  sessionId,
  explicit,
  effective,
  eligible,
  labels,
}: {
  tenantId: string;
  sessionId: string;
  explicit: ExplicitRow[];
  effective: EffectiveRow[];
  eligible: EligibleRow[];
  labels: InstructorBlockLabels;
}) {
  const TYPE_LABEL: Record<string, string> = {
    primary: `Hoofd${labels.singular.toLowerCase()}`,
    assistant: "Assistent",
    substitute: "Vervanger",
    observer: "Observer",
  };
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [memberId, setMemberId] = useState("");
  const [type, setType] = useState<"primary" | "assistant" | "substitute" | "observer">("primary");
  const [replaces, setReplaces] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const isExplicitMode = explicit.length > 0;
  const explicitIds = new Set(explicit.map((e) => e.member_id));
  const eligibleForAdd = eligible.filter((e) => !explicitIds.has(e.id));

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    if (!memberId) {
      setErr("Kies een lid");
      return;
    }
    startTransition(async () => {
      const res = await assignSessionInstructor({
        tenant_id: tenantId,
        session_id: sessionId,
        member_id: memberId,
        assignment_type: type,
        replaces_member_id: type === "substitute" ? (replaces || null) : null,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMemberId("");
      setReplaces("");
      setType("primary");
      router.refresh();
    });
  }

  function onRemove(id: string) {
    if (!confirm("Toewijzing verwijderen?")) return;
    startTransition(async () => {
      const res = await unassignSessionInstructor(tenantId, id);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  const inputCls = "h-9 w-full rounded-lg border bg-transparent px-2 text-xs outline-none";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  } as const;

  return (
    <section
      className="rounded-2xl border p-4 sm:p-6"
      style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {labels.plural} ({effective.length})
        </h2>
        {!isExplicitMode && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px]"
            style={{ backgroundColor: "var(--surface-soft)", color: "var(--text-secondary)" }}
          >
            impliciet (alle {labels.plural.toLowerCase()} van de groep)
          </span>
        )}
      </div>

      {effective.length > 0 && (
        <ul className="mb-4 grid gap-1.5 text-xs">
          {effective.map((row) => {
            const ex = explicit.find((e) => e.member_id === row.member_id);
            return (
              <li
                key={row.member_id}
                className="flex items-center justify-between rounded-lg border px-3 py-1.5"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <span style={{ color: "var(--text-primary)" }}>
                  <strong>{row.full_name}</strong>{" "}
                  <span style={{ color: "var(--text-secondary)" }}>
                    · {TYPE_LABEL[row.assignment_type] ?? row.assignment_type}
                    {ex?.replaces_member_name ? ` (vervangt ${ex.replaces_member_name})` : ""}
                    {!row.is_explicit ? " · impliciet" : ""}
                  </span>
                </span>
                {ex && (
                  <button
                    type="button"
                    onClick={() => onRemove(ex.id)}
                    disabled={pending}
                    aria-label="Verwijderen"
                    className="rounded-md p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={onAdd} className="grid gap-2 border-t pt-3" style={{ borderColor: "var(--surface-border)" }}>
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            disabled={pending}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">— Lid kiezen —</option>
            {eligibleForAdd.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            disabled={pending}
            className={inputCls}
            style={inputStyle}
          >
            <option value="primary">Hoofd{labels.singular.toLowerCase()}</option>
            <option value="assistant">Assistent</option>
            <option value="substitute">Vervanger</option>
            <option value="observer">Observer</option>
          </select>
          {type === "substitute" ? (
            <select
              value={replaces}
              onChange={(e) => setReplaces(e.target.value)}
              disabled={pending}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">— Vervangt (optioneel) —</option>
              {explicit.map((e) => (
                <option key={e.member_id} value={e.member_id}>{e.full_name}</option>
              ))}
            </select>
          ) : (
            <div />
          )}
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)", width: "fit-content" }}
        >
          {pending ? "Bezig…" : `${labels.singular} toewijzen`}
        </button>
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Eerste expliciete toewijzing schakelt de impliciete fallback uit voor deze sessie.
        </p>
      </form>
    </section>
  );
}
