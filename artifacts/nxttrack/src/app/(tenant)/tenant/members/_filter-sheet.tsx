"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Filter, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const ROLE_LABELS: Record<string, string> = {
  parent: "Ouder",
  athlete: "Speler",
  trainer: "Trainer",
  staff: "Staf",
  volunteer: "Vrijwilliger",
};

const STATUS_LABELS: Record<string, string> = {
  prospect: "Prospect",
  invited: "Uitgenodigd",
  aspirant: "Aspirant",
  pending: "In behandeling",
  active: "Actief",
  paused: "Gepauzeerd",
  inactive: "Inactief",
  cancelled: "Opgezegd",
};

const ALL_ROLES = ["parent", "athlete", "trainer", "staff", "volunteer"];
const ALL_STATUSES = [
  "prospect",
  "invited",
  "aspirant",
  "pending",
  "active",
  "paused",
  "inactive",
  "cancelled",
];

export interface FilterSheetProps {
  groups: Array<{ id: string; name: string }>;
  plans: Array<{ id: string; name: string }>;
  /** Read-only chips above the table. */
  showArchived: boolean;
}

export function MembersFilterSheet({ groups, plans }: FilterSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  // Local state mirrors current URL params; reset on open.
  const initial = useMemo(() => readFromParams(params), [params, open]);
  const [search, setSearch] = useState(initial.search);
  const [roles, setRoles] = useState<string[]>(initial.roles);
  const [statuses, setStatuses] = useState<string[]>(initial.statuses);
  const [groupId, setGroupId] = useState(initial.group);
  const [planId, setPlanId] = useState(initial.plan);
  const [sinceFrom, setSinceFrom] = useState(initial.sinceFrom);
  const [sinceTo, setSinceTo] = useState(initial.sinceTo);

  useEffect(() => {
    if (!open) return;
    setSearch(initial.search);
    setRoles(initial.roles);
    setStatuses(initial.statuses);
    setGroupId(initial.group);
    setPlanId(initial.plan);
    setSinceFrom(initial.sinceFrom);
    setSinceTo(initial.sinceTo);
  }, [open, initial]);

  function toggle<T extends string>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  function apply() {
    const next = new URLSearchParams(params.toString());
    next.delete("q");
    next.delete("role");
    next.delete("st");
    next.delete("group");
    next.delete("plan");
    next.delete("since_from");
    next.delete("since_to");
    next.delete("page");
    if (search.trim()) next.set("q", search.trim());
    for (const r of roles) next.append("role", r);
    for (const s of statuses) next.append("st", s);
    if (groupId) next.set("group", groupId);
    if (planId) next.set("plan", planId);
    if (sinceFrom) next.set("since_from", sinceFrom);
    if (sinceTo) next.set("since_to", sinceTo);
    router.push(`${pathname}?${next.toString()}`);
    setOpen(false);
  }

  function clear() {
    setSearch("");
    setRoles([]);
    setStatuses([]);
    setGroupId("");
    setPlanId("");
    setSinceFrom("");
    setSinceTo("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors"
        style={{
          borderColor: "var(--surface-border)",
          backgroundColor: "var(--surface-soft)",
          color: "var(--text-primary)",
        }}
      >
        <Filter className="h-3.5 w-3.5" />
        Filters
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md"
          style={{ backgroundColor: "var(--surface-main)" }}
        >
          <SheetHeader>
            <SheetTitle style={{ color: "var(--text-primary)" }}>
              Filters
            </SheetTitle>
            <SheetDescription>
              Beperk de ledenlijst op basis van rollen, status, groep, abonnement of lidmaatschapsdatum.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-5">
            <Field label="Zoeken">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Naam of e-mail"
                className="h-9 w-full rounded-lg border px-2 text-sm"
                style={{
                  borderColor: "var(--surface-border)",
                  backgroundColor: "var(--surface-soft)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>

            <Field label="Rollen">
              <div className="flex flex-wrap gap-1.5">
                {ALL_ROLES.map((r) => (
                  <Chip
                    key={r}
                    active={roles.includes(r)}
                    onClick={() => setRoles((prev) => toggle(prev, r))}
                    label={ROLE_LABELS[r]}
                  />
                ))}
              </div>
            </Field>

            <Field label="Status">
              <div className="flex flex-wrap gap-1.5">
                {ALL_STATUSES.map((s) => (
                  <Chip
                    key={s}
                    active={statuses.includes(s)}
                    onClick={() => setStatuses((prev) => toggle(prev, s))}
                    label={STATUS_LABELS[s] ?? s}
                  />
                ))}
              </div>
            </Field>

            <Field label="Groep">
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="h-9 w-full rounded-lg border px-2 text-sm"
                style={{
                  borderColor: "var(--surface-border)",
                  backgroundColor: "var(--surface-soft)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">Alle groepen</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Abonnement">
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="h-9 w-full rounded-lg border px-2 text-sm"
                style={{
                  borderColor: "var(--surface-border)",
                  backgroundColor: "var(--surface-soft)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">Alle abonnementen</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Lid sinds van">
                <input
                  type="date"
                  value={sinceFrom}
                  onChange={(e) => setSinceFrom(e.target.value)}
                  className="h-9 w-full rounded-lg border px-2 text-sm"
                  style={{
                    borderColor: "var(--surface-border)",
                    backgroundColor: "var(--surface-soft)",
                    color: "var(--text-primary)",
                  }}
                />
              </Field>
              <Field label="tot">
                <input
                  type="date"
                  value={sinceTo}
                  onChange={(e) => setSinceTo(e.target.value)}
                  className="h-9 w-full rounded-lg border px-2 text-sm"
                  style={{
                    borderColor: "var(--surface-border)",
                    backgroundColor: "var(--surface-soft)",
                    color: "var(--text-primary)",
                  }}
                />
              </Field>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={clear}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Wis filters
              </button>
              <button
                type="button"
                onClick={apply}
                className="h-9 rounded-lg border px-4 text-xs font-semibold"
                style={{
                  borderColor: "var(--surface-border)",
                  backgroundColor: "var(--accent)",
                  color: "var(--text-primary)",
                }}
              >
                Toepassen
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="mb-1 block text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
      style={{
        borderColor: active
          ? "color-mix(in srgb, var(--accent) 60%, var(--surface-border))"
          : "var(--surface-border)",
        backgroundColor: active
          ? "color-mix(in srgb, var(--accent) 20%, var(--surface-soft))"
          : "var(--surface-soft)",
        color: "var(--text-primary)",
      }}
    >
      {label}
    </button>
  );
}

function readFromParams(params: URLSearchParams) {
  return {
    search: params.get("q") ?? "",
    roles: params.getAll("role"),
    statuses: params.getAll("st"),
    group: params.get("group") ?? "",
    plan: params.get("plan") ?? "",
    sinceFrom: params.get("since_from") ?? "",
    sinceTo: params.get("since_to") ?? "",
  };
}

/**
 * Read-only filter chips rendered above the table. Each chip removes
 * the corresponding param from the URL when clicked.
 */
export function ActiveFiltersStrip({
  groups,
  plans,
}: {
  groups: Array<{ id: string; name: string }>;
  plans: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const search = params.get("q");
  const roles = params.getAll("role");
  const statuses = params.getAll("st");
  const groupId = params.get("group");
  const planId = params.get("plan");
  const sinceFrom = params.get("since_from");
  const sinceTo = params.get("since_to");

  const groupName = groupId ? groups.find((g) => g.id === groupId)?.name : null;
  const planName = planId ? plans.find((p) => p.id === planId)?.name : null;

  const chips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (search)
    chips.push({
      key: "q",
      label: `Zoek: "${search}"`,
      remove: () => removeParam("q"),
    });
  for (const r of roles) {
    chips.push({
      key: `role-${r}`,
      label: ROLE_LABELS[r] ?? r,
      remove: () => removeMulti("role", r),
    });
  }
  for (const s of statuses) {
    chips.push({
      key: `st-${s}`,
      label: `Status: ${STATUS_LABELS[s] ?? s}`,
      remove: () => removeMulti("st", s),
    });
  }
  if (groupId)
    chips.push({
      key: "group",
      label: `Groep: ${groupName ?? groupId}`,
      remove: () => removeParam("group"),
    });
  if (planId)
    chips.push({
      key: "plan",
      label: `Abonnement: ${planName ?? planId}`,
      remove: () => removeParam("plan"),
    });
  if (sinceFrom)
    chips.push({
      key: "since_from",
      label: `Sinds vanaf: ${sinceFrom}`,
      remove: () => removeParam("since_from"),
    });
  if (sinceTo)
    chips.push({
      key: "since_to",
      label: `Sinds tot: ${sinceTo}`,
      remove: () => removeParam("since_to"),
    });

  function removeParam(name: string) {
    const next = new URLSearchParams(params.toString());
    next.delete(name);
    next.delete("page");
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}`);
  }
  function removeMulti(name: string, value: string) {
    const next = new URLSearchParams();
    for (const [k, v] of params.entries()) {
      if (k === name && v === value) continue;
      if (k === "page") continue;
      next.append(k, v);
    }
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}`);
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.remove}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-black/5"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: "var(--surface-soft)",
            color: "var(--text-primary)",
          }}
        >
          {c.label}
          <X className="h-3 w-3" style={{ color: "var(--text-secondary)" }} />
        </button>
      ))}
    </div>
  );
}
