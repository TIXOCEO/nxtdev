"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, X } from "lucide-react";
import { createConversation } from "@/lib/actions/tenant/messages";

interface Recipient {
  id: string;
  full_name: string;
  is_staff: boolean;
}

export function ComposeForm({
  tenantId,
  slug,
  recipients,
  allowMulti,
}: {
  tenantId: string;
  slug: string;
  recipients: Recipient[];
  allowMulti: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((r) => r.full_name.toLowerCase().includes(q));
  }, [recipients, filter]);

  const pickedRecipients = useMemo(
    () => recipients.filter((r) => picked.includes(r.id)),
    [recipients, picked],
  );

  function toggle(id: string) {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (!allowMulti) return [id];
      return [...prev, id];
    });
  }

  function submit() {
    setError(null);
    if (!title.trim()) return setError("Titel is verplicht");
    if (!body.trim()) return setError("Bericht is verplicht");
    if (picked.length === 0) return setError("Kies minstens één ontvanger");
    start(async () => {
      const res = await createConversation({
        tenant_id: tenantId,
        title: title.trim(),
        body: body.trim(),
        recipient_member_ids: picked,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/t/${slug}/messages/${res.data.conversation_id}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Ontvangers
        </label>
        {pickedRecipients.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pickedRecipients.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--text-primary)",
                }}
              >
                {r.full_name}
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Zoek persoon…"
          className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        />
        <div
          className="max-h-56 overflow-y-auto rounded-xl border"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          {filtered.length === 0 ? (
            <p
              className="px-3 py-3 text-center text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Geen leden gevonden.
            </p>
          ) : (
            <ul>
              {filtered.map((r) => {
                const sel = picked.includes(r.id);
                return (
                  <li
                    key={r.id}
                    className="border-b last:border-b-0"
                    style={{ borderColor: "var(--surface-border)" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-black/5"
                    >
                      <div>
                        <p
                          className="text-xs font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {r.full_name}
                        </p>
                        {r.is_staff && (
                          <p
                            className="text-[10px]"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Trainer / Beheerder
                          </p>
                        )}
                      </div>
                      <span
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold"
                        style={{
                          backgroundColor: sel ? "var(--accent)" : "transparent",
                          borderColor: sel ? "var(--accent)" : "var(--surface-border)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {sel ? "✓" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Titel
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <div className="space-y-1">
        <label
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Bericht
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={8000}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {error && (
        <p className="text-xs" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Send className="h-3.5 w-3.5" />
          {pending ? "Versturen…" : "Versturen"}
        </button>
      </div>
    </div>
  );
}
