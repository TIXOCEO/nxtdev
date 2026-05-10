"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Star, Trash2 } from "lucide-react";
import {
  linkGroup,
  unlinkGroup,
  setPrimaryGroup,
} from "@/lib/actions/tenant/programs";
import type { ProgramGroupRow, AvailableGroupRow } from "@/lib/db/programs";

interface Props {
  tenantId: string;
  programId: string;
  linked: ProgramGroupRow[];
  available: AvailableGroupRow[];
}

export function GroupsTab({ tenantId, programId, linked, available }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickGroup, setPickGroup] = useState<string>(available[0]?.id ?? "");
  const [pickPrimary, setPickPrimary] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function refresh() { router.refresh(); }

  function onLink(e: React.FormEvent) {
    e.preventDefault();
    if (!pickGroup) return;
    setErr(null);
    startTransition(async () => {
      const res = await linkGroup({
        tenant_id: tenantId,
        program_id: programId,
        group_id: pickGroup,
        is_primary: pickPrimary,
      });
      if (!res.ok) { setErr(res.error); return; }
      setPickPrimary(false);
      refresh();
    });
  }

  function onUnlink(group_id: string) {
    setErr(null);
    startTransition(async () => {
      const res = await unlinkGroup({ tenant_id: tenantId, program_id: programId, group_id });
      if (!res.ok) { setErr(res.error); return; }
      refresh();
    });
  }

  function onSetPrimary(group_id: string) {
    setErr(null);
    startTransition(async () => {
      const res = await setPrimaryGroup({ tenant_id: tenantId, program_id: programId, group_id });
      if (!res.ok) { setErr(res.error); return; }
      refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Gekoppelde groepen ({linked.length})
        </h2>
        {linked.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nog geen groepen gekoppeld aan dit programma.
          </p>
        ) : (
          <ul className="grid gap-1.5 text-xs">
            {linked.map((g) => (
              <li
                key={g.group_id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {g.is_primary && (
                    <Star
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--accent)", fill: "var(--accent)" }}
                      aria-label="Primaire groep"
                    />
                  )}
                  <Link
                    href={`/tenant/groups/${g.group_id}`}
                    className="truncate font-medium hover:underline"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {g.group_name}
                  </Link>
                  <span style={{ color: "var(--text-secondary)" }}>
                    · {g.member_count} leden
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!g.is_primary && (
                    <button
                      type="button"
                      onClick={() => onSetPrimary(g.group_id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] disabled:opacity-50"
                      style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                    >
                      <Star className="h-3 w-3" /> Maak primair
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onUnlink(g.group_id)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-red-600 disabled:opacity-50"
                    style={{ borderColor: "var(--surface-border)" }}
                    aria-label={`Ontkoppel ${g.group_name}`}
                  >
                    <Trash2 className="h-3 w-3" /> Ontkoppelen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Groep koppelen
        </h2>
        {available.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Alle groepen van deze tenant zijn al gekoppeld aan dit programma.
          </p>
        ) : (
          <form onSubmit={onLink} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <select
              value={pickGroup}
              onChange={(e) => setPickGroup(e.target.value)}
              className="h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
                backgroundColor: "var(--surface-main)",
              }}
            >
              {available.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.member_count} leden)
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={pickPrimary}
                onChange={(e) => setPickPrimary(e.target.checked)}
                className="h-4 w-4"
              />
              Primair
            </label>
            <button
              type="submit"
              disabled={pending || !pickGroup}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
            >
              <Plus className="h-4 w-4" /> Koppelen
            </button>
          </form>
        )}
        {err && <p className="mt-2 text-xs text-red-600" role="alert">{err}</p>}
      </section>
    </div>
  );
}
