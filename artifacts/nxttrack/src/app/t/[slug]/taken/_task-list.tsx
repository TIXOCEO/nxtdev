"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { setTrainerTaskStatus } from "@/lib/actions/tenant/trainer-tasks";
import type { TrainerTask } from "@/lib/db/trainer-tasks";
import {
  TrainerStatusPill,
  TrainerSurface,
} from "@/components/public/trainer-shell-components";

interface Props {
  tenantId: string;
  tasks: TrainerTask[];
}

function groupTasks(tasks: TrainerTask[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inOneWeek = new Date(today);
  inOneWeek.setDate(inOneWeek.getDate() + 7);

  const buckets = {
    todayBucket: [] as TrainerTask[],
    thisWeek: [] as TrainerTask[],
    later: [] as TrainerTask[],
    noDeadline: [] as TrainerTask[],
    done: [] as TrainerTask[],
  };
  for (const t of tasks) {
    if (t.status === "done" || t.status === "cancelled") {
      buckets.done.push(t);
      continue;
    }
    if (!t.due_date) {
      buckets.noDeadline.push(t);
      continue;
    }
    const d = new Date(t.due_date);
    if (d <= today) buckets.todayBucket.push(t);
    else if (d <= inOneWeek) buckets.thisWeek.push(t);
    else buckets.later.push(t);
  }
  return buckets;
}

const PRIORITY_TONE: Record<string, { tone: "danger" | "warning" | "info"; label: string }> = {
  high: { tone: "danger", label: "Hoog" },
  normal: { tone: "warning", label: "Normaal" },
  low: { tone: "info", label: "Laag" },
};

export function TrainerTaskList({ tenantId, tasks: initial }: Props) {
  const [tasks, setTasks] = useState(initial);
  const [pending, startTransition] = useTransition();

  const buckets = groupTasks(tasks);

  function toggle(task: TrainerTask) {
    const next = task.status === "done" ? "open" : "done";
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: next, completed_at: next === "done" ? new Date().toISOString() : null }
          : t,
      ),
    );
    startTransition(async () => {
      await setTrainerTaskStatus(tenantId, task.id, next);
    });
  }

  const sections: Array<[string, TrainerTask[]]> = [
    ["Vandaag / te laat", buckets.todayBucket],
    ["Deze week", buckets.thisWeek],
    ["Later", buckets.later],
    ["Zonder deadline", buckets.noDeadline],
    ["Afgerond", buckets.done],
  ];

  return (
    <div className="flex flex-col gap-4">
      {sections.map(([heading, list]) =>
        list.length === 0 ? null : (
          <div key={heading} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              {heading} <span className="opacity-60">({list.length})</span>
            </h3>
            <TrainerSurface className="divide-y overflow-hidden">
              {list.map((t) => {
                const p = PRIORITY_TONE[t.priority] ?? PRIORITY_TONE.normal;
                const isDone = t.status === "done" || t.status === "cancelled";
                return (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]"
                    style={{ borderColor: "var(--surface-border)", opacity: isDone ? 0.55 : 1 }}
                  >
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggle(t)}
                      disabled={pending}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded"
                      style={{ accentColor: "var(--brand-navy)" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-medium ${isDone ? "line-through" : ""}`}
                          style={{ color: "var(--text-primary)" }}
                        >
                          {t.title}
                        </span>
                        <TrainerStatusPill toneKey={p.tone}>
                          {p.label}
                        </TrainerStatusPill>
                        {isDone && (
                          <TrainerStatusPill toneKey="success" icon={CheckCircle2}>
                            Klaar
                          </TrainerStatusPill>
                        )}
                        {t.due_date && (
                          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                            <CalendarClock className="h-3.5 w-3.5" />
                            {new Date(t.due_date).toLocaleDateString("nl-NL", { day: "2-digit", month: "short" })}
                          </span>
                        )}
                      </div>
                      {t.body && (
                        <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {t.body}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </TrainerSurface>
          </div>
        ),
      )}
    </div>
  );
}
