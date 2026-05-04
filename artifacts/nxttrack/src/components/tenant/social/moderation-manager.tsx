"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Pin,
  PinOff,
  MessageSquareOff,
  MessageSquare,
  VolumeX,
  Volume2,
  Trash2,
} from "lucide-react";
import {
  moderatePost,
  pinPost,
  unmuteMember,
  muteMember,
} from "@/lib/actions/tenant/social-moderation";
import type { Post, SocialMute } from "@/types/database";
import type { ModerationStats } from "@/lib/db/social";

interface PostRow extends Post {
  author: { id: string; full_name: string } | null;
}
interface MuteRow extends SocialMute {
  member: { id: string; full_name: string } | null;
}

interface Props {
  tenantId: string;
  stats: ModerationStats;
  posts: PostRow[];
  mutes: MuteRow[];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-xl font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

export function ModerationManager({ tenantId, stats, posts, mutes }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string } | { ok: true; data?: unknown } | { ok: false; error: string }>) {
    setError(null);
    start(async () => {
      const res = (await fn()) as { ok: boolean; error?: string };
      if (!res.ok) setError(res.error ?? "Mislukt");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Posts" value={stats.totalPosts} />
        <StatTile label="Verborgen posts" value={stats.hiddenPosts} />
        <StatTile label="Reacties" value={stats.totalComments} />
        <StatTile label="Verborgen reacties" value={stats.hiddenComments} />
        <StatTile label="Gedempte leden" value={stats.mutedMembers} />
      </section>

      {error && (
        <p className="text-xs" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      <section>
        <h2
          className="mb-2 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Recente berichten
        </h2>
        {posts.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen berichten geplaatst.
          </p>
        ) : (
          <ul className="space-y-2">
            {posts.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border px-3 py-2"
                style={{
                  backgroundColor: p.is_hidden
                    ? "rgba(220,38,38,0.06)"
                    : "var(--surface-main)",
                  borderColor: p.is_hidden
                    ? "rgba(220,38,38,0.3)"
                    : "var(--surface-border)",
                }}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className="font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.author?.full_name ?? "Systeem"}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {fmt(p.created_at)}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: "var(--surface-soft)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {p.visibility}
                  </span>
                  {p.coach_broadcast && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: "var(--accent)",
                        color: "var(--text-primary)",
                      }}
                    >
                      Coach
                    </span>
                  )}
                </div>
                {p.content && (
                  <p
                    className="mt-1 line-clamp-3 text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.content}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        moderatePost({
                          tenant_id: tenantId,
                          id: p.id,
                          action: p.is_hidden ? "unhide" : "hide",
                        }),
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: "var(--surface-soft)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {p.is_hidden ? (
                      <>
                        <Eye className="h-3 w-3" /> Tonen
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3" /> Verbergen
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        pinPost({
                          tenant_id: tenantId,
                          id: p.id,
                          pin: !p.is_pinned,
                        }),
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: "var(--surface-soft)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {p.is_pinned ? (
                      <>
                        <PinOff className="h-3 w-3" /> Losmaken
                      </>
                    ) : (
                      <>
                        <Pin className="h-3 w-3" /> Vastpinnen
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        moderatePost({
                          tenant_id: tenantId,
                          id: p.id,
                          action: "toggle_comments",
                        }),
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: "var(--surface-soft)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {p.comments_enabled ? (
                      <>
                        <MessageSquareOff className="h-3 w-3" /> Reacties uit
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-3 w-3" /> Reacties aan
                      </>
                    )}
                  </button>
                  {p.author_member_id && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          muteMember({
                            tenant_id: tenantId,
                            member_id: p.author_member_id!,
                            reason: "Vanuit moderatie",
                          }),
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold"
                      style={{
                        backgroundColor: "rgba(220,38,38,0.1)",
                        color: "#dc2626",
                      }}
                    >
                      <VolumeX className="h-3 w-3" /> Demp auteur
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2
          className="mb-2 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Gedempte leden
        </h2>
        {mutes.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Geen leden gedempt.
          </p>
        ) : (
          <ul className="space-y-2">
            {mutes.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                style={{
                  backgroundColor: "var(--surface-main)",
                  borderColor: "var(--surface-border)",
                }}
              >
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {m.member?.full_name ?? "Onbekend"}
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Sinds {fmt(m.created_at)}
                    {m.muted_until ? ` · tot ${fmt(m.muted_until)}` : " · permanent"}
                    {m.reason ? ` · ${m.reason}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      unmuteMember({
                        tenant_id: tenantId,
                        member_id: m.member_id,
                      }),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold"
                  style={{
                    backgroundColor: "var(--surface-soft)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Volume2 className="h-3 w-3" />
                  Demping opheffen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
