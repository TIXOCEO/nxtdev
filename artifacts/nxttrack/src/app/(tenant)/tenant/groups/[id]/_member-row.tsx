"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { removeMemberFromGroup } from "@/lib/actions/tenant/members";

export interface GroupMemberRowProps {
  tenantId: string;
  groupId: string;
  memberId: string;
  name: string;
  status?: string | null;
  joinedAt?: string | null;
  /** Render in table-row mode (td) instead of li mode. */
  asTableRow?: boolean;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function GroupMemberRow({
  tenantId,
  groupId,
  memberId,
  name,
  status,
  joinedAt,
  asTableRow = false,
}: GroupMemberRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function remove() {
    setErr(null);
    startTransition(async () => {
      const res = await removeMemberFromGroup({
        tenant_id: tenantId,
        group_id: groupId,
        member_id: memberId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (asTableRow) {
    return (
      <tr style={{ color: "var(--text-primary)" }}>
        <td className="px-4 py-3">
          <p className="text-sm font-medium">{name}</p>
          {err && <p className="text-[11px] text-red-600">{err}</p>}
        </td>
        <td
          className="px-4 py-3 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          {status ?? "—"}
        </td>
        <td
          className="px-4 py-3 text-xs whitespace-nowrap"
          style={{ color: "var(--text-secondary)" }}
        >
          {formatDate(joinedAt ?? null)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/tenant/members/${memberId}`}
              className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-medium"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            >
              <ExternalLink className="h-3 w-3" /> Profiel
            </Link>
            {confirming ? (
              <>
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "rgb(220 38 38)" }}
                >
                  Bevestig
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="inline-flex h-8 items-center rounded-lg px-2 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Annuleer
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={pending}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-50"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-secondary)",
                }}
                aria-label="Verwijderen uit groep"
                title="Verwijderen uit groep"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {name}
        </p>
        {status && (
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {status}
          </p>
        )}
        {err && <p className="text-[11px] text-red-600">{err}</p>}
      </div>
      <Link
        href={`/tenant/members/${memberId}`}
        className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-medium"
        style={{
          borderColor: "var(--surface-border)",
          color: "var(--text-primary)",
        }}
      >
        <ExternalLink className="h-3 w-3" /> Profiel
      </Link>
      <button
        type="button"
        onClick={() => {
          if (confirm(`${name} uit de groep verwijderen?`)) remove();
        }}
        disabled={pending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50"
        style={{ color: "var(--text-secondary)" }}
        aria-label="Verwijderen"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
