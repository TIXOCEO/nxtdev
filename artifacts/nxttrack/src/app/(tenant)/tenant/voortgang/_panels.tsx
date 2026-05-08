"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateProgressRenderStyle,
  upsertScoringLabel,
  deleteScoringLabel,
} from "@/lib/actions/tenant/progress-settings";

type RenderStyle = "text" | "stars" | "emoji";

interface LabelRow {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  emoji: string | null;
  star_value: number | null;
  sort_order: number;
}

export interface ProgressSettingsPanelsProps {
  tenantId: string;
  initialRenderStyle: RenderStyle;
  initialLabels: LabelRow[];
}

export function ProgressSettingsPanels(props: ProgressSettingsPanelsProps) {
  return (
    <div className="space-y-6">
      <RenderStylePanel
        tenantId={props.tenantId}
        initial={props.initialRenderStyle}
      />
      <LabelsPanel
        tenantId={props.tenantId}
        initial={props.initialLabels}
        renderStyle={props.initialRenderStyle}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
function RenderStylePanel({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: RenderStyle;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [val, setVal] = useState<RenderStyle>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await updateProgressRenderStyle({
        tenant_id: tenantId,
        progress_render_style: val,
      });
      if (!res.ok) return setErr(res.error);
      setMsg("Opgeslagen.");
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-2xl border p-4 sm:p-6"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        Weergave-stijl
      </h2>
      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        Schermlezers blijven het tekstuele label horen — alleen de visuele rendering verandert.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {(["text", "stars", "emoji"] as RenderStyle[]).map((rs) => (
          <label
            key={rs}
            className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <input
              type="radio"
              name="rs"
              value={rs}
              checked={val === rs}
              onChange={() => setVal(rs)}
              disabled={pending}
              className="mt-1"
            />
            <span>
              <span className="block font-medium" style={{ color: "var(--text-primary)" }}>
                {rs === "text" ? "Tekst-badge" : rs === "stars" ? "Sterren" : "Emoji"}
              </span>
              <span className="block text-xs" style={{ color: "var(--text-secondary)" }}>
                {rs === "text"
                  ? "Toon de naam van het label."
                  : rs === "stars"
                  ? "Toon 1-5 sterren op basis van star_value."
                  : "Toon de emoji die je per label instelt."}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs">
          {err && <span className="text-red-600">{err}</span>}
          {msg && <span className="text-green-600">{msg}</span>}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending || val === initial}
          className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Opslaan..." : "Opslaan"}
        </button>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
function LabelsPanel({
  tenantId,
  initial,
  renderStyle,
}: {
  tenantId: string;
  initial: LabelRow[];
  renderStyle: RenderStyle;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<LabelRow[]>(initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Lokale draft voor "nieuw label".
  const [draft, setDraft] = useState({
    slug: "",
    name: "",
    color: "",
    emoji: "",
    star_value: "",
    sort_order: rows.length,
  });

  function patchRow(id: string, patch: Partial<LabelRow>) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function saveRow(row: LabelRow) {
    setErr(null);
    start(async () => {
      const res = await upsertScoringLabel({
        tenant_id: tenantId,
        id: row.id,
        slug: row.slug,
        name: row.name,
        color: row.color || null,
        emoji: row.emoji || null,
        star_value: row.star_value ?? null,
        sort_order: row.sort_order,
      });
      if (!res.ok) return setErr(res.error);
      router.refresh();
    });
  }

  function removeRow(row: LabelRow) {
    if (!confirm(`Label "${row.name}" verwijderen?`)) return;
    setErr(null);
    start(async () => {
      const res = await deleteScoringLabel({ tenant_id: tenantId, id: row.id });
      if (!res.ok) return setErr(res.error);
      setRows((r) => r.filter((x) => x.id !== row.id));
      router.refresh();
    });
  }

  function addRow() {
    setErr(null);
    if (!draft.slug.trim() || !draft.name.trim()) {
      setErr("Slug en naam zijn verplicht.");
      return;
    }
    start(async () => {
      const res = await upsertScoringLabel({
        tenant_id: tenantId,
        slug: draft.slug.trim(),
        name: draft.name.trim(),
        color: draft.color.trim() || null,
        emoji: draft.emoji.trim() || null,
        star_value:
          draft.star_value === "" ? null : Number.parseInt(draft.star_value, 10),
        sort_order: draft.sort_order,
      });
      if (!res.ok) return setErr(res.error);
      setDraft({ slug: "", name: "", color: "", emoji: "", star_value: "", sort_order: rows.length + 1 });
      router.refresh();
    });
  }

  const cell = "h-9 rounded-md border bg-transparent px-2 text-sm w-full";
  const cellStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  } as const;

  return (
    <section
      className="rounded-2xl border p-4 sm:p-6"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Scoring-labels
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Alleen positieve labels — afkeurende waardes worden door de database geweigerd.
            {renderStyle === "stars" && " Vul 'Sterren' in (1-5) zodat de weergave werkt."}
            {renderStyle === "emoji" && " Vul 'Emoji' in zodat de weergave werkt."}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Nog geen labels.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: "var(--text-secondary)" }}>
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Slug</th>
                <th className="py-2 pr-2">Naam</th>
                <th className="py-2 pr-2">Kleur</th>
                <th className="py-2 pr-2">Emoji</th>
                <th className="py-2 pr-2">Sterren</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: "var(--surface-border)" }}>
                  <td className="py-2 pr-2 w-16">
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={r.sort_order}
                      onChange={(e) => patchRow(r.id, { sort_order: Number(e.target.value) })}
                      className={cell}
                      style={cellStyle}
                    />
                  </td>
                  <td className="py-2 pr-2 w-40">
                    <input
                      value={r.slug}
                      onChange={(e) => patchRow(r.id, { slug: e.target.value })}
                      className={cell}
                      style={cellStyle}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={r.name}
                      onChange={(e) => patchRow(r.id, { name: e.target.value })}
                      className={cell}
                      style={cellStyle}
                    />
                  </td>
                  <td className="py-2 pr-2 w-28">
                    <input
                      value={r.color ?? ""}
                      onChange={(e) => patchRow(r.id, { color: e.target.value })}
                      placeholder="#22c55e"
                      className={cell}
                      style={cellStyle}
                    />
                  </td>
                  <td className="py-2 pr-2 w-20">
                    <input
                      value={r.emoji ?? ""}
                      onChange={(e) => patchRow(r.id, { emoji: e.target.value })}
                      placeholder="⭐"
                      className={cell}
                      style={cellStyle}
                    />
                  </td>
                  <td className="py-2 pr-2 w-20">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={r.star_value ?? ""}
                      onChange={(e) =>
                        patchRow(r.id, {
                          star_value:
                            e.target.value === "" ? null : Number.parseInt(e.target.value, 10),
                        })
                      }
                      className={cell}
                      style={cellStyle}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => saveRow(r)}
                      disabled={pending}
                      className="mr-2 rounded-md bg-black px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                    >
                      Opslaan
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(r)}
                      disabled={pending}
                      className="rounded-md border px-3 py-1 text-xs disabled:opacity-60"
                      style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                    >
                      Verwijder
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        className="mt-6 rounded-xl border p-3"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Nieuw label
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-6">
          <input
            placeholder="Slug"
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            className={cell}
            style={cellStyle}
          />
          <input
            placeholder="Naam"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className={cell + " sm:col-span-2"}
            style={cellStyle}
          />
          <input
            placeholder="#kleur"
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            className={cell}
            style={cellStyle}
          />
          <input
            placeholder="Emoji"
            value={draft.emoji}
            onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
            className={cell}
            style={cellStyle}
          />
          <input
            placeholder="Sterren 1-5"
            type="number"
            min={1}
            max={5}
            value={draft.star_value}
            onChange={(e) => setDraft({ ...draft, star_value: e.target.value })}
            className={cell}
            style={cellStyle}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Tip: hogere sort_order = positiever (sort_order ≥ 4 telt mee voor diploma-readiness).
          </span>
          <button
            type="button"
            onClick={addRow}
            disabled={pending}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Toevoegen
          </button>
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </section>
  );
}
