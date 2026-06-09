"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { setMemberPublicTrainerSettings } from "@/lib/actions/tenant/sponsors";

interface Props {
  tenantId: string;
  memberId: string;
  initialShowInPublic: boolean;
  initialBio: string;
  // Sprint 78b — extra publieke trainerskaart-velden.
  initialRoleLabel?: string;
  initialPhotoUrl?: string;
  initialPosition?: number;
}

export function TrainerPublicSettings({
  tenantId,
  memberId,
  initialShowInPublic,
  initialBio,
  initialRoleLabel = "",
  initialPhotoUrl = "",
  initialPosition = 0,
}: Props) {
  const [show, setShow] = useState(initialShowInPublic);
  const [bio, setBio] = useState(initialBio);
  const [roleLabel, setRoleLabel] = useState(initialRoleLabel);
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [position, setPosition] = useState<string>(String(initialPosition ?? 0));
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setDone(null);
    start(async () => {
      const parsedPos = Number.parseInt(position, 10);
      const res = await setMemberPublicTrainerSettings({
        tenant_id: tenantId,
        member_id: memberId,
        show_in_public: show,
        public_bio: bio,
        public_role_label: roleLabel.trim() || null,
        public_photo_url: photoUrl.trim() || null,
        public_position: Number.isFinite(parsedPos) ? parsedPos : 0,
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

      <Field label="Functietitel (max 80)">
        <input
          type="text"
          value={roleLabel}
          onChange={(e) => setRoleLabel(e.target.value)}
          maxLength={80}
          placeholder="Bv. Hoofdinstructeur"
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--shell-border)", color: "var(--text-primary)" }}
        />
      </Field>

      <Field label="Foto-URL (https://...)">
        <input
          type="url"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--shell-border)", color: "var(--text-primary)" }}
        />
      </Field>

      <Field label="Sortering (lager = eerder)">
        <input
          type="number"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-32 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--shell-border)", color: "var(--text-primary)" }}
        />
      </Field>

      <Field label="Publieke bio">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--shell-border)", color: "var(--text-primary)" }}
        />
      </Field>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="mb-1 block text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
