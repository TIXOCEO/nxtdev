"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { createNotification } from "@/lib/actions/tenant/notifications";
import type { NotificationTargetInput } from "@/lib/validation/notifications";

export interface NotificationFormProps {
  tenantId: string;
  members: Array<{ id: string; full_name: string }>;
  groups: Array<{ id: string; name: string }>;
}

const ROLES: Array<{ value: string; label: string }> = [
  { value: "parent", label: "Ouders" },
  { value: "athlete", label: "Atleten (volwassen)" },
  { value: "trainer", label: "Trainers" },
  { value: "staff", label: "Staf" },
  { value: "volunteer", label: "Vrijwilligers" },
];

type Mode = "all" | "members" | "groups" | "roles";

export function NotificationForm({ tenantId, members, groups }: NotificationFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set());
  const [roleKeys, setRoleKeys] = useState<Set<string>>(new Set());
  const [sendEmail, setSendEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filteredMembers = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return members.slice(0, 200);
    return members
      .filter((m) => m.full_name.toLowerCase().includes(q))
      .slice(0, 200);
  }, [members, filter]);

  function toggleSet(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  function buildTargets(): NotificationTargetInput[] {
    if (mode === "all") return [{ target_type: "all" }];
    if (mode === "members")
      return Array.from(memberIds).map((id) => ({ target_type: "member" as const, target_id: id }));
    if (mode === "groups")
      return Array.from(groupIds).map((id) => ({ target_type: "group" as const, target_id: id }));
    return Array.from(roleKeys).map((id) => ({ target_type: "role" as const, target_id: id }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const targets = buildTargets();
    if (targets.length === 0) {
      setError("Selecteer minstens één ontvanger.");
      return;
    }
    if (title.trim().length < 2) {
      setError("Titel is verplicht.");
      return;
    }
    const plain = contentHtml.replace(/<[^>]*>/g, "").trim();
    if (plain.length === 0) {
      setError("Bericht mag niet leeg zijn.");
      return;
    }
    startTransition(async () => {
      const res = await createNotification({
        tenant_id: tenantId,
        title: title.trim(),
        content_html: contentHtml,
        content_text: plain,
        targets,
        send_email: sendEmail,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(
        `Verstuurd naar ${res.data.recipientCount} ontvanger(s)` +
          (res.data.emailsSent > 0 ? ` · ${res.data.emailsSent} e-mails` : ""),
      );
      setTimeout(() => router.push("/tenant/notifications"), 600);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <label
          className="mb-1 block text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Titel
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Bijv. Training afgelast vrijdag"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <div>
        <label
          className="mb-1 block text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Bericht
        </label>
        <TiptapEditor
          placeholder="Schrijf hier je melding..."
          onChange={(out) => setContentHtml(out.html)}
        />
      </div>

      <div>
        <label
          className="mb-2 block text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Ontvangers
        </label>
        <div className="mb-3 flex flex-wrap gap-2">
          {(["all", "members", "groups", "roles"] as const).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMode(m)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={
                mode === m
                  ? {
                      backgroundColor: "var(--accent)",
                      borderColor: "var(--surface-border)",
                      color: "var(--text-primary)",
                    }
                  : {
                      backgroundColor: "var(--surface-soft)",
                      borderColor: "var(--surface-border)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              {m === "all"
                ? "Iedereen"
                : m === "members"
                ? "Specifieke leden"
                : m === "groups"
                ? "Groepen"
                : "Rollen"}
            </button>
          ))}
        </div>

        {mode === "all" && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Alle actieve leden krijgen deze melding. Minderjarigen worden automatisch
            doorgestuurd naar hun gekoppelde ouder(s).
          </p>
        )}

        {mode === "members" && (
          <div className="space-y-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Zoek lid..."
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                backgroundColor: "var(--surface-soft)",
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
            <div
              className="max-h-56 overflow-y-auto rounded-md border"
              style={{ borderColor: "var(--surface-border)" }}
            >
              {filteredMembers.length === 0 ? (
                <p className="px-3 py-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Geen leden gevonden.
                </p>
              ) : (
                filteredMembers.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
                    style={{ borderColor: "var(--surface-border)" }}
                  >
                    <input
                      type="checkbox"
                      checked={memberIds.has(m.id)}
                      onChange={() => setMemberIds((s) => toggleSet(s, m.id))}
                    />
                    <span style={{ color: "var(--text-primary)" }}>{m.full_name}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {memberIds.size} geselecteerd
            </p>
          </div>
        )}

        {mode === "groups" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {groups.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Nog geen groepen aangemaakt.
              </p>
            )}
            {groups.map((g) => (
              <label
                key={g.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                style={{
                  backgroundColor: "var(--surface-soft)",
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={groupIds.has(g.id)}
                  onChange={() => setGroupIds((s) => toggleSet(s, g.id))}
                />
                {g.name}
              </label>
            ))}
          </div>
        )}

        {mode === "roles" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                style={{
                  backgroundColor: "var(--surface-soft)",
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={roleKeys.has(r.value)}
                  onChange={() => setRoleKeys((s) => toggleSet(s, r.value))}
                />
                {r.label}
              </label>
            ))}
          </div>
        )}
      </div>

      <label
        className="flex items-center gap-2 text-sm"
        style={{ color: "var(--text-primary)" }}
      >
        <input
          type="checkbox"
          checked={sendEmail}
          onChange={(e) => setSendEmail(e.target.checked)}
        />
        Ook als e-mail versturen
      </label>

      {error && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{
            borderColor: "rgba(220,38,38,0.4)",
            backgroundColor: "rgba(254,226,226,0.7)",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{
            borderColor: "rgba(34,197,94,0.4)",
            backgroundColor: "rgba(220,252,231,0.7)",
            color: "#166534",
          }}
        >
          {success}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{
            backgroundColor: "var(--accent)",
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        >
          {pending ? "Versturen..." : "Verstuur melding"}
        </button>
      </div>
    </form>
  );
}
