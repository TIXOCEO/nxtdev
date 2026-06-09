"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrainerTask } from "@/lib/actions/tenant/trainer-tasks";

interface TrainerOption {
  user_id: string;
  full_name: string;
}

export function NewTaskForm({
  tenantId,
  trainers,
}: {
  tenantId: string;
  trainers: TrainerOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assignedTo, setAssignedTo] = useState(trainers[0]?.user_id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!assignedTo) {
      setError("Kies een trainer.");
      return;
    }
    startTransition(async () => {
      const res = await createTrainerTask(tenantId, {
        assigned_to_user_id: assignedTo,
        title: title.trim(),
        body: body.trim() ? body.trim() : null,
        due_date: dueDate || null,
        priority,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTitle("");
      setBody("");
      setDueDate("");
      setPriority("normal");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border p-4"
      style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--surface-card)" }}
    >
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Nieuwe taak
      </h3>

      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Trainer</span>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--surface-input)" }}
        >
          {trainers.length === 0 && <option value="">Geen trainers</option>}
          {trainers.map((t) => (
            <option key={t.user_id} value={t.user_id}>
              {t.full_name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Titel</span>
        <input
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--surface-input)" }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Beschrijving (optioneel)</span>
        <textarea
          rows={3}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--surface-input)" }}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Deadline</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--surface-input)" }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Prioriteit</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--surface-input)" }}
          >
            <option value="low">Laag</option>
            <option value="normal">Normaal</option>
            <option value="high">Hoog</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="text-xs" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !title.trim() || !assignedTo}
        className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
      >
        {pending ? "Bezig…" : "Taak toevoegen"}
      </button>
    </form>
  );
}
