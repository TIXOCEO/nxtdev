"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { bulkAddMembersToGroup } from "@/lib/actions/tenant/members";

export interface CsvImportProps {
  tenantId: string;
  groupId: string;
}

interface PreviewRow {
  raw: Record<string, string>;
  match_key: string;
  match_value: string;
  member_id: string | null;
  full_name: string | null;
  reason: string | null;
}

interface PreviewResponse {
  rows: PreviewRow[];
  matched: number;
  unmatched: number;
}

export function CsvImport({ tenantId, groupId }: CsvImportProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [pending, startTransition] = useTransition();

  async function runPreview(f: File) {
    setError(null);
    setPreview(null);
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`/tenant/groups/${groupId}/api/import-preview`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? "Preview mislukt.");
        return;
      }
      const json = (await res.json()) as PreviewResponse;
      setPreview(json);
    } finally {
      setPreviewing(false);
    }
  }

  function commit() {
    if (!preview) return;
    const memberIds = preview.rows
      .filter((r) => r.member_id)
      .map((r) => r.member_id as string);
    if (memberIds.length === 0) {
      setError("Geen herkende rijen om toe te voegen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await bulkAddMembersToGroup({
        tenant_id: tenantId,
        group_id: groupId,
        member_ids: memberIds,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFile(null);
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
          style={{
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        >
          <Upload className="h-3.5 w-3.5" />
          {file ? file.name : "Kies CSV…"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setPreview(null);
              setError(null);
              if (f) void runPreview(f);
            }}
          />
        </label>
        {previewing && (
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            <Loader2 className="h-3 w-3 animate-spin" /> Bezig met inlezen…
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {preview && (
        <div
          className="overflow-hidden rounded-xl border text-xs"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            style={{
              backgroundColor: "var(--surface-soft)",
              color: "var(--text-secondary)",
            }}
          >
            <span>
              {preview.matched} herkend · {preview.unmatched} niet gevonden
            </span>
            <button
              type="button"
              onClick={commit}
              disabled={pending || preview.matched === 0}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold disabled:opacity-50"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--text-primary)",
              }}
            >
              {pending ? "Bezig…" : `Voeg ${preview.matched} toe`}
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full">
              <thead style={{ color: "var(--text-secondary)" }}>
                <tr className="text-left">
                  <th className="px-3 py-2">Match</th>
                  <th className="px-3 py-2">Waarde</th>
                  <th className="px-3 py-2">Resultaat</th>
                </tr>
              </thead>
              <tbody
                className="divide-y"
                style={{ borderColor: "var(--surface-border)" }}
              >
                {preview.rows.map((r, i) => (
                  <tr key={i} style={{ color: "var(--text-primary)" }}>
                    <td className="px-3 py-2">{r.match_key}</td>
                    <td className="px-3 py-2 font-mono">{r.match_value}</td>
                    <td className="px-3 py-2">
                      {r.member_id ? (
                        <span style={{ color: "var(--text-primary)" }}>
                          ✓ {r.full_name}
                        </span>
                      ) : (
                        <span className="text-red-600">✗ {r.reason ?? "Niet gevonden"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
