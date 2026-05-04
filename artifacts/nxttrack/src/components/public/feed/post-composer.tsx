"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Megaphone } from "lucide-react";
import { createPost } from "@/lib/actions/public/social";

interface Props {
  tenantId: string;
  groups: Array<{ id: string; name: string }>;
  members: Array<{ id: string; full_name: string }>;
  canCoachBroadcast: boolean;
  allowMedia: boolean;
}

export function PostComposer({
  tenantId,
  groups,
  members,
  canCoachBroadcast,
  allowMedia,
}: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [visibility, setVisibility] = useState<
    "tenant" | "team" | "trainers" | "private"
  >("tenant");
  const [targetId, setTargetId] = useState<string>("");
  const [coach, setCoach] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!content.trim() && !mediaUrl.trim()) {
      setError("Voer tekst of media in.");
      return;
    }
    start(async () => {
      const res = await createPost({
        tenant_id: tenantId,
        type: "user",
        content: content.trim() || null,
        media_url: mediaUrl.trim() || null,
        media_type: mediaUrl.trim() ? mediaType : null,
        visibility,
        target_id: targetId || null,
        comments_enabled: true,
        coach_broadcast: coach,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setContent("");
      setMediaUrl("");
      setCoach(false);
      router.refresh();
    });
  }

  const inputClass =
    "w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
  } as const;

  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder="Wat wil je delen?"
        className={inputClass}
        style={inputStyle}
      />
      {allowMedia && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="Media URL (optioneel)"
            className={`${inputClass} sm:col-span-2`}
            style={inputStyle}
          />
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as "image" | "video")}
            className={inputClass}
            style={inputStyle}
          >
            <option value="image">Afbeelding</option>
            <option value="video">Video</option>
          </select>
        </div>
      )}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          value={visibility}
          onChange={(e) => {
            setVisibility(e.target.value as typeof visibility);
            setTargetId("");
          }}
          className={inputClass}
          style={inputStyle}
        >
          <option value="tenant">Hele club</option>
          <option value="team">Team / groep</option>
          <option value="trainers">Alleen trainers</option>
          <option value="private">Privé (specifiek lid)</option>
        </select>
        {visibility === "team" && (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Kies een groep…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
        {visibility === "private" && (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Kies een lid…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {canCoachBroadcast && (
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={coach}
              onChange={(e) => setCoach(e.target.checked)}
            />
            <Megaphone className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
            <span style={{ color: "var(--text-primary)" }}>Coach-broadcast</span>
          </label>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Send className="h-3.5 w-3.5" />
          {pending ? "Plaatsen…" : "Plaatsen"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-[11px]" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
    </section>
  );
}
