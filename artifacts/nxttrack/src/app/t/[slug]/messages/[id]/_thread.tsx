"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import {
  replyToConversation,
  deleteConversationForMe,
} from "@/lib/actions/tenant/messages";

interface ThreadMessage {
  id: string;
  body: string;
  created_at: string;
  sender_member_id: string;
  sender_name: string;
}

export function Thread({
  tenantId,
  slug,
  conversationId,
  myMemberId,
  initialMessages,
}: {
  tenantId: string;
  slug: string;
  conversationId: string;
  myMemberId: string;
  initialMessages: ThreadMessage[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();

  function send() {
    if (!body.trim()) {
      setError("Bericht is leeg");
      return;
    }
    setError(null);
    start(async () => {
      const res = await replyToConversation({
        tenant_id: tenantId,
        conversation_id: conversationId,
        body: body.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  function leave() {
    if (!window.confirm("Gesprek uit je inbox verwijderen?")) return;
    startDelete(async () => {
      const res = await deleteConversationForMe({
        tenant_id: tenantId,
        conversation_id: conversationId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/t/${slug}/messages`);
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <ul className="space-y-2">
        {initialMessages.map((m) => {
          const mine = m.sender_member_id === myMemberId;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[85%] rounded-2xl border px-3 py-2"
                style={{
                  backgroundColor: mine ? "var(--accent)" : "var(--surface-main)",
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
              >
                <p className="text-[10px] font-semibold opacity-80">
                  {mine ? "Jij" : m.sender_name} · {fmt(m.created_at)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div
        className="rounded-2xl border p-2"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Schrijf een antwoord…"
          className="w-full resize-none rounded-lg px-2 py-1.5 text-sm outline-none"
          style={{
            backgroundColor: "var(--surface-soft)",
            color: "var(--text-primary)",
          }}
        />
        {error && (
          <p className="mt-1 text-xs" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={leave}
            disabled={deleting}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
            style={{ color: "#b91c1c" }}
          >
            <Trash2 className="h-3 w-3" />
            Verwijder uit inbox
          </button>
          <button
            type="button"
            onClick={send}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Send className="h-3 w-3" />
            {pending ? "Versturen…" : "Versturen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
