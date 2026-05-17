"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  markCapacityEventHandled,
  dismissCapacityEvent,
} from "@/lib/actions/tenant/capacity-events";

/**
 * Sprint 76 — Eén kaart per open capacity_available_event, met de
 * top-wachtlijst-kandidaten en de twee admin-acties (afhandelen /
 * wegklikken). Acties triggeren een server action + router.refresh().
 */

const TRIGGER_LABEL: Record<string, string> = {
  member_removed: "Lid verliet groep",
  capacity_increased: "Capaciteit verhoogd",
  manual: "Handmatig gemeld",
};

interface Candidate {
  submission_id: string;
  contact_name: string | null;
  contact_email: string | null;
  program_id: string | null;
  program_name: string | null;
  created_at: string;
  status: string;
}

interface Props {
  eventId: string;
  groupId: string;
  groupName: string;
  triggerSource: string;
  freedSeats: number;
  candidateCount: number;
  createdAt: string;
  candidates: Candidate[];
}

export function CapacityEventCard({
  eventId,
  groupId,
  groupName,
  triggerSource,
  freedSeats,
  candidateCount,
  createdAt,
  candidates,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(action: "handled" | "dismissed") {
    setError(null);
    startTransition(async () => {
      const res =
        action === "handled"
          ? await markCapacityEventHandled({ eventId })
          : await dismissCapacityEvent({ eventId });
      if (!res.ok) {
        setError(res.error ?? "Actie mislukte");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: "4px solid #10b981",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            {TRIGGER_LABEL[triggerSource] ?? triggerSource}
            {" · "}
            {freedSeats} {freedSeats === 1 ? "plek" : "plekken"} vrij
          </div>
          <h3 className="mt-1 text-base font-semibold">
            <Link href={`/tenant/groups/${groupId}`} className="underline">
              {groupName}
            </Link>
          </h3>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {new Date(createdAt).toLocaleString("nl-NL")}
            {" · "}
            {candidateCount} wachtende {candidateCount === 1 ? "kandidaat" : "kandidaten"}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handle("handled")}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-sm font-medium"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-foreground, white)",
              opacity: pending ? 0.6 : 1,
            }}
          >
            Markeer als afgehandeld
          </button>
          <button
            type="button"
            onClick={() => handle("dismissed")}
            disabled={pending}
            className="rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)", opacity: pending ? 0.6 : 1 }}
          >
            Wegklikken
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-xs" style={{ color: "var(--danger, #c0392b)" }}>
          {error}
        </p>
      ) : null}

      {candidates.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          Geen wachtende kandidaten gevonden voor dit programma. Mogelijk is de
          plek al ingevuld door een directe inschrijving — markeer als
          afgehandeld of klik weg.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-2 py-1 text-left font-medium">Naam</th>
                <th className="px-2 py-1 text-left font-medium">Programma</th>
                <th className="px-2 py-1 text-left font-medium">Wachtend sinds</th>
                <th className="px-2 py-1 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.submission_id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-2 py-1">{c.contact_name ?? "—"}</td>
                  <td className="px-2 py-1">{c.program_name ?? "—"}</td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString("nl-NL")}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Link
                      href={`/tenant/intake/${c.submission_id}`}
                      className="underline"
                    >
                      Open placement →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
