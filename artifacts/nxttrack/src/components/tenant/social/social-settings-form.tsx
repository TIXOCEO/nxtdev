"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { updateSocialSettings } from "@/lib/actions/tenant/social-settings";
import type { SocialSettings } from "@/types/database";

interface Props {
  tenantId: string;
  initial: SocialSettings;
}

const FIELDS: Array<{
  key: keyof Omit<
    SocialSettings,
    "tenant_id" | "created_at" | "updated_at"
  >;
  label: string;
  description: string;
}> = [
  { key: "allow_posts", label: "Berichten toestaan", description: "Leden mogen nieuwe berichten plaatsen." },
  { key: "allow_comments", label: "Reacties toestaan", description: "Leden mogen reageren op berichten." },
  { key: "allow_likes", label: "Likes toestaan", description: "Leden mogen berichten een like geven." },
  { key: "allow_media", label: "Media toestaan", description: "Leden mogen afbeeldingen of video's bijvoegen." },
  { key: "allow_auto_posts", label: "Automatische posts", description: "Sta system / achievement / training-recap posts toe." },
  { key: "allow_mentions", label: "@mentions toestaan", description: "Leden mogen anderen noemen via @-mentions." },
  { key: "minor_read_only", label: "Minderjarigen alleen-lezen", description: "Minderjarige atleten mogen niet plaatsen, reageren of liken." },
  { key: "minor_team_feed_allowed", label: "Team-feed voor minderjarigen", description: "Toon teamposts ook aan minderjarigen." },
];

export function SocialSettingsForm({ tenantId, initial }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof SocialSettings, value: boolean) {
    setState((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updateSocialSettings({
        tenant_id: tenantId,
        allow_posts: state.allow_posts,
        allow_comments: state.allow_comments,
        allow_likes: state.allow_likes,
        allow_media: state.allow_media,
        allow_auto_posts: state.allow_auto_posts,
        allow_mentions: state.allow_mentions,
        minor_read_only: state.minor_read_only,
        minor_team_feed_allowed: state.minor_team_feed_allowed,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {FIELDS.map((f) => (
          <li
            key={f.key}
            className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
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
                {f.label}
              </p>
              <p
                className="text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {f.description}
              </p>
            </div>
            <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={Boolean(state[f.key])}
                onChange={(e) => toggle(f.key, e.target.checked)}
              />
              <span
                className="absolute inset-0 rounded-full transition-colors"
                style={{
                  backgroundColor: state[f.key]
                    ? "var(--accent)"
                    : "var(--surface-border)",
                }}
              />
              <span
                className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                style={{
                  transform: state[f.key] ? "translateX(16px)" : "none",
                }}
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--text-primary)",
          }}
        >
          <Save className="h-3.5 w-3.5" />
          {pending ? "Opslaan…" : "Opslaan"}
        </button>
        {saved && (
          <span className="text-xs" style={{ color: "var(--accent)" }}>
            Opgeslagen.
          </span>
        )}
        {error && (
          <span className="text-xs" style={{ color: "#dc2626" }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
