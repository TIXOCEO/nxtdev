"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, UserPlus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { addMemberToGroup } from "@/lib/actions/tenant/members";

export interface AddMemberPopoverProps {
  tenantId: string;
  groupId: string;
  /** Already filled when opened from the overview row; null disables opening. */
  isFull: boolean;
  fullTooltip?: string;
  /** Optional role filter so the trainer/athlete tabs only suggest the right people. */
  roleFilter?: string;
  /** Trigger button label. Default: "Lid toevoegen". */
  label?: string;
  /** When true, render a small icon-only ghost button (used in overview rows). */
  compact?: boolean;
}

interface Hit {
  id: string;
  full_name: string;
  email: string | null;
  athlete_code: string | null;
  roles: string[];
}

const ROLE_LABELS: Record<string, string> = {
  parent: "Ouder",
  athlete: "Speler",
  trainer: "Trainer",
  staff: "Staf",
  volunteer: "Vrijwilliger",
};

export function AddMemberPopover({
  tenantId,
  groupId,
  isFull,
  fullTooltip,
  roleFilter,
  label = "Lid toevoegen",
  compact = false,
}: AddMemberPopoverProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const reqIdRef = useRef(0);

  // Sprint 42 — debounce live search server-side. We bumpen een request-id
  // zodat een trage oude response niet de nieuwste hits overschrijft.
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    const myReqId = ++reqIdRef.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          group_id: groupId,
        });
        if (roleFilter) params.set("role", roleFilter);
        const res = await fetch(`/tenant/groups/${groupId}/api/search?${params.toString()}`);
        if (!res.ok) {
          if (myReqId === reqIdRef.current) {
            setHits([]);
            setErr("Zoekopdracht mislukt.");
          }
          return;
        }
        const json = (await res.json()) as { hits: Hit[] };
        if (myReqId === reqIdRef.current) {
          setHits(json.hits ?? []);
          setErr(null);
        }
      } catch {
        if (myReqId === reqIdRef.current) {
          setHits([]);
          setErr("Zoekopdracht mislukt.");
        }
      } finally {
        if (myReqId === reqIdRef.current) setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, open, groupId, roleFilter]);

  function add(hit: Hit) {
    setErr(null);
    startTransition(async () => {
      const res = await addMemberToGroup({
        tenant_id: tenantId,
        group_id: groupId,
        member_id: hit.id,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      // Verwijder de hit uit de lijst zodat herhaald toevoegen niet kan.
      setHits((prev) => prev.filter((h) => h.id !== hit.id));
      router.refresh();
    });
  }

  const trigger = compact ? (
    <button
      type="button"
      disabled={isFull}
      title={isFull ? fullTooltip ?? "Groep is vol" : label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs disabled:opacity-40"
      style={{
        borderColor: "var(--surface-border)",
        color: "var(--text-primary)",
      }}
    >
      <UserPlus className="h-3.5 w-3.5" />
    </button>
  ) : (
    <button
      type="button"
      disabled={isFull}
      title={isFull ? fullTooltip ?? "Groep is vol" : undefined}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold disabled:opacity-50"
      style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
    >
      <Plus className="h-3.5 w-3.5" /> {label}
    </button>
  );

  return (
    <Popover open={open && !isFull} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-3"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--text-secondary)" }}
          />
          <input
            id={inputId}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek op naam of e-mail…"
            className="h-9 w-full rounded-xl border bg-transparent pl-7 pr-3 text-sm outline-none"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-soft)",
            }}
          />
          {searching && (
            <Loader2
              className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin"
              style={{ color: "var(--text-secondary)" }}
            />
          )}
        </div>

        <div className="mt-2 max-h-64 overflow-y-auto">
          {query.trim().length < 2 ? (
            <p
              className="px-2 py-3 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Typ minimaal 2 tekens om te zoeken.
            </p>
          ) : hits.length === 0 && !searching ? (
            <p
              className="px-2 py-3 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Geen resultaten.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
              {hits.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center gap-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {h.full_name}
                    </p>
                    <p
                      className="truncate text-[11px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {h.athlete_code && (
                        <span
                          className="mr-1 rounded px-1 font-mono"
                          style={{ backgroundColor: "var(--surface-soft)" }}
                        >
                          {h.athlete_code}
                        </span>
                      )}
                      {h.email ?? "—"}
                      {h.roles.length > 0 && (
                        <>
                          {" · "}
                          {h.roles
                            .map((r) => ROLE_LABELS[r] ?? r)
                            .join(", ")}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => add(h)}
                    disabled={pending}
                    className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Plus className="h-3 w-3" /> Voeg toe
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {err && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {err}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
