"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { awardChildDiploma } from "@/lib/actions/tenant/child-diplomas";

interface MemberOption {
  id: string;
  full_name: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewDiplomaForm({
  tenantId,
  members,
}: {
  tenantId: string;
  members: MemberOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [diplomaName, setDiplomaName] = useState("");
  const [level, setLevel] = useState("");
  const [awardedOn, setAwardedOn] = useState(todayIso());
  const [certificateUrl, setCertificateUrl] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!memberId) {
      setError("Kies een lid.");
      return;
    }
    startTransition(async () => {
      const res = await awardChildDiploma(tenantId, {
        member_id: memberId,
        diploma_name: diplomaName.trim(),
        level: level.trim() ? level.trim() : null,
        awarded_on: awardedOn,
        awarded_by_member_id: null,
        certificate_url: certificateUrl.trim() ? certificateUrl.trim() : null,
        photo_url: null,
        notes: notes.trim() ? notes.trim() : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDiplomaName("");
      setLevel("");
      setCertificateUrl("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border p-4"
      style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-card)" }}
    >
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Diploma toekennen
      </h3>

      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Lid</span>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-input)" }}
        >
          {members.length === 0 && <option value="">Geen leden</option>}
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Diploma naam</span>
        <input
          required
          maxLength={120}
          value={diplomaName}
          onChange={(e) => setDiplomaName(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-input)" }}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Niveau (optioneel)</span>
          <input
            maxLength={40}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-input)" }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span style={{ color: "var(--text-secondary)" }}>Datum</span>
          <input
            type="date"
            required
            value={awardedOn}
            onChange={(e) => setAwardedOn(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-input)" }}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Certificaat-URL (optioneel)</span>
        <input
          value={certificateUrl}
          onChange={(e) => setCertificateUrl(e.target.value)}
          placeholder="https://… of /uploads/…"
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-input)" }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: "var(--text-secondary)" }}>Opmerking (optioneel)</span>
        <textarea
          rows={2}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-input)" }}
        />
      </label>

      {error && <p className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>}

      <button
        type="submit"
        disabled={pending || !diplomaName.trim() || !memberId}
        className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
      >
        {pending ? "Bezig…" : "Diploma toekennen"}
      </button>
    </form>
  );
}
