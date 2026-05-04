"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { setMemberPublicTrainerSettings } from "@/lib/actions/tenant/sponsors";

interface Props {
  tenantId: string;
  memberId: string;
  initialShowInPublic: boolean;
  initialBio: string;
}

export function TrainerPublicSettings({
  tenantId,
  memberId,
  initialShowInPublic,
  initialBio,
}: Props) {
  const [show, setShow] = useState(initialShowInPublic);
  const [bio, setBio] = useState(initialBio);
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await setMemberPublicTrainerSettings({
        tenant_id: tenantId,
        member_id: memberId,
        show_in_public: show,
        public_bio: bio,
      });
      if (!res.ok) setError(res.error);
      else setDone("Opgeslagen");
    });
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
        />
        <span style={{ color: "var(--text-primary)" }}>
          Toon deze trainer publiek op de homepage
        </span>
      </label>
      <label className="block">
        <span
          className="mb-1 block text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Publieke bio
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Save className="h-3 w-3" /> Opslaan
        </button>
        {done && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{done}</span>}
        {error && <span className="text-xs" style={{ color: "#dc2626" }}>{error}</span>}
      </div>
    </div>
  );
}
