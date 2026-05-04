"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Pin, EyeOff, Megaphone, Trash2 } from "lucide-react";
import { toggleLike, deletePost } from "@/lib/actions/public/social";

export interface PostCardData {
  post: {
    id: string;
    type: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    visibility: string;
    is_pinned: boolean;
    coach_broadcast: boolean;
    comments_enabled: boolean;
    created_at: string;
    author_member_id: string | null;
  };
  author: { id: string; full_name: string } | null;
  likes_count: number;
  comments_count: number;
  viewer_liked: boolean;
}

interface Props {
  tenantId: string;
  tenantSlug: string;
  data: PostCardData;
  canModify: boolean;
}

function fmt(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("nl-NL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PostCard({ tenantId, tenantSlug, data, canModify }: Props) {
  const router = useRouter();
  const [liked, setLiked] = useState(data.viewer_liked);
  const [count, setCount] = useState(data.likes_count);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onLike() {
    setError(null);
    const prev = liked;
    setLiked(!prev);
    setCount((c) => c + (prev ? -1 : 1));
    start(async () => {
      const res = await toggleLike({
        tenant_id: tenantId,
        post_id: data.post.id,
        emoji: "👍",
      });
      if (!res.ok) {
        setLiked(prev);
        setCount((c) => c + (prev ? 1 : -1));
        setError(res.error);
      } else {
        setLiked(res.data.liked);
      }
    });
  }

  function onDelete() {
    if (!confirm("Bericht verwijderen?")) return;
    start(async () => {
      const res = await deletePost({ tenant_id: tenantId, id: data.post.id });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <article
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: data.post.is_pinned
          ? "var(--accent)"
          : "var(--surface-border)",
      }}
    >
      <header className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          {data.author?.full_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {data.author?.full_name ?? "Systeem"}
            </p>
            {data.post.coach_broadcast && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--text-primary)",
                }}
              >
                <Megaphone className="h-2.5 w-2.5" />
                Coach
              </span>
            )}
            {data.post.is_pinned && (
              <Pin
                className="h-3 w-3"
                style={{ color: "var(--accent)" }}
              />
            )}
          </div>
          <p
            className="text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {fmt(data.post.created_at)} · {data.post.visibility}
          </p>
        </div>
      </header>

      {data.post.content && (
        <p
          className="mt-3 whitespace-pre-wrap text-sm"
          style={{ color: "var(--text-primary)" }}
        >
          {data.post.content}
        </p>
      )}

      {data.post.media_url && data.post.media_type === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.post.media_url}
          alt=""
          className="mt-3 max-h-96 w-full rounded-lg object-cover"
        />
      )}
      {data.post.media_url && data.post.media_type === "video" && (
        <video
          src={data.post.media_url}
          controls
          className="mt-3 max-h-96 w-full rounded-lg"
        />
      )}

      <footer
        className="mt-3 flex items-center gap-4 border-t pt-3 text-xs"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <button
          type="button"
          onClick={onLike}
          disabled={pending}
          className="inline-flex items-center gap-1 disabled:opacity-50"
          style={{
            color: liked ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          <Heart
            className="h-4 w-4"
            fill={liked ? "currentColor" : "none"}
          />
          {count}
        </button>
        <Link
          href={`/t/${tenantSlug}/feed/${data.post.id}`}
          className="inline-flex items-center gap-1"
          style={{ color: "var(--text-secondary)" }}
        >
          <MessageCircle className="h-4 w-4" />
          {data.comments_count}
        </Link>
        {canModify && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1 disabled:opacity-50"
            style={{ color: "#dc2626" }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Verwijderen
          </button>
        )}
        {!data.post.comments_enabled && (
          <span
            className="ml-auto inline-flex items-center gap-1"
            style={{ color: "var(--text-secondary)" }}
          >
            <EyeOff className="h-3 w-3" />
            Reacties uit
          </span>
        )}
      </footer>
      {error && (
        <p className="mt-2 text-[11px]" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
    </article>
  );
}
