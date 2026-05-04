"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2, CornerDownRight } from "lucide-react";
import { createComment, deleteComment } from "@/lib/actions/public/social";
import type { Comment } from "@/types/database";

interface CommentRow extends Comment {
  author: { id: string; full_name: string } | null;
}

interface Props {
  tenantId: string;
  postId: string;
  comments: CommentRow[];
  canComment: boolean;
  myMemberId: string | null;
  isAdmin: boolean;
}

function fmt(iso: string) {
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

export function CommentThread({
  tenantId,
  postId,
  comments,
  canComment,
  myMemberId,
  isAdmin,
}: Props) {
  // Build tree (max 2 levels per spec).
  const top = comments.filter((c) => !c.parent_id);
  const replies = new Map<string, CommentRow[]>();
  for (const c of comments) {
    if (c.parent_id) {
      const list = replies.get(c.parent_id) ?? [];
      list.push(c);
      replies.set(c.parent_id, list);
    }
  }

  return (
    <div className="space-y-3">
      {canComment && (
        <CommentForm tenantId={tenantId} postId={postId} parentId={null} />
      )}
      {top.length === 0 && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen reacties.
        </p>
      )}
      {top.map((c) => (
        <CommentItem
          key={c.id}
          tenantId={tenantId}
          postId={postId}
          comment={c}
          replies={replies.get(c.id) ?? []}
          canComment={canComment}
          myMemberId={myMemberId}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}

function CommentItem({
  tenantId,
  postId,
  comment,
  replies,
  canComment,
  myMemberId,
  isAdmin,
}: {
  tenantId: string;
  postId: string;
  comment: CommentRow;
  replies: CommentRow[];
  canComment: boolean;
  myMemberId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canDelete =
    isAdmin || (myMemberId !== null && comment.author_member_id === myMemberId);

  function onDelete() {
    if (!confirm("Reactie verwijderen?")) return;
    start(async () => {
      const res = await deleteComment({ tenant_id: tenantId, id: comment.id });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        backgroundColor: "var(--surface-soft)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <p
          className="text-xs font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {comment.author?.full_name ?? "Onbekend"}
        </p>
        <span
          className="text-[11px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {fmt(comment.created_at)}
        </span>
      </div>
      <p
        className="mt-1 whitespace-pre-wrap text-sm"
        style={{ color: "var(--text-primary)" }}
      >
        {comment.content}
      </p>
      <div className="mt-1 flex items-center gap-3 text-[11px]">
        {canComment && !comment.parent_id && (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            style={{ color: "var(--accent)" }}
          >
            {replying ? "Annuleren" : "Reageren"}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center gap-1"
            style={{ color: "#dc2626" }}
          >
            <Trash2 className="h-3 w-3" />
            Verwijderen
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-[11px]" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
      {replying && (
        <div className="mt-2">
          <CommentForm
            tenantId={tenantId}
            postId={postId}
            parentId={comment.id}
            onDone={() => setReplying(false)}
          />
        </div>
      )}
      {replies.length > 0 && (
        <ul className="mt-2 space-y-2 pl-4">
          {replies.map((r) => (
            <li
              key={r.id}
              className="flex gap-2 rounded-lg border px-3 py-2"
              style={{
                backgroundColor: "var(--surface-main)",
                borderColor: "var(--surface-border)",
              }}
            >
              <CornerDownRight
                className="h-3 w-3 shrink-0"
                style={{ color: "var(--text-secondary)" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className="text-xs font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {r.author?.full_name ?? "Onbekend"}
                  </p>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {fmt(r.created_at)}
                  </span>
                </div>
                <p
                  className="mt-1 whitespace-pre-wrap text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {r.content}
                </p>
                {(isAdmin ||
                  (myMemberId !== null && r.author_member_id === myMemberId)) && (
                  <DeleteReplyButton tenantId={tenantId} id={r.id} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeleteReplyButton({ tenantId, id }: { tenantId: string; id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Reactie verwijderen?")) return;
        start(async () => {
          const res = await deleteComment({ tenant_id: tenantId, id });
          if (res.ok) router.refresh();
        });
      }}
      className="mt-1 inline-flex items-center gap-1 text-[11px]"
      style={{ color: "#dc2626" }}
    >
      <Trash2 className="h-3 w-3" />
      Verwijderen
    </button>
  );
}

function CommentForm({
  tenantId,
  postId,
  parentId,
  onDone,
}: {
  tenantId: string;
  postId: string;
  parentId: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!content.trim()) {
      setError("Reactie mag niet leeg zijn.");
      return;
    }
    start(async () => {
      const res = await createComment({
        tenant_id: tenantId,
        post_id: postId,
        parent_id: parentId,
        content: content.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setContent("");
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="flex items-start gap-2">
      <textarea
        rows={2}
        maxLength={1500}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Schrijf een reactie…"
        className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
        style={{
          borderColor: "var(--surface-border)",
          color: "var(--text-primary)",
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-lg p-2 disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
      >
        <Send className="h-4 w-4" />
      </button>
      {error && (
        <p className="text-[11px]" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}
