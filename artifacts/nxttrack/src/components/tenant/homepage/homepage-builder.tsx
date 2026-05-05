"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Trash2, Settings2, Eye, EyeOff, Smartphone, Monitor, Plus, ChevronDown, ChevronUp } from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  addTenantModule,
  deleteTenantModule,
  updateTenantModule,
  updateModuleLayout,
} from "@/lib/actions/tenant/homepage";
import type { ModuleCatalog, ModuleSize, TenantModule } from "@/types/database";
import { ModuleConfigEditor, type PageOption } from "./module-config-editor";
import { ModuleAddDialog, FULL_BLEED_KEYS } from "./module-add-dialog";

const GridLayout = dynamic(
  () => import("react-grid-layout/legacy").then((m) => m.default),
  { ssr: false },
);

interface Props {
  tenantId: string;
  initialModules: TenantModule[];
  catalog: ModuleCatalog[];
  pages?: PageOption[];
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
}

const COLS = 2;
const ROW_HEIGHT = 160;

function moduleToLayoutItem(m: TenantModule): LayoutItem {
  return {
    i: m.id,
    x: Math.max(0, Math.min(1, m.position_x ?? 0)),
    y: Math.max(0, m.position_y ?? 0),
    w: Math.max(1, Math.min(2, m.w ?? (m.size === "2x1" ? 2 : 1))),
    h: Math.max(1, Math.min(2, m.h ?? (m.size === "1x2" ? 2 : 1))),
  };
}

function whToSize(w: number, h: number): ModuleSize {
  if (w >= 2 && h >= 2) return "2x2";
  if (w >= 2) return "2x1";
  if (h >= 2) return "1x2";
  return "1x1";
}

export function HomepageBuilder({
  tenantId,
  initialModules,
  catalog,
  pages = [],
}: Props) {
  const router = useRouter();
  const [modules, setModules] = useState<TenantModule[]>(initialModules);
  const [adding, setAdding] = useState(false);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const layout = useMemo<LayoutItem[]>(
    () =>
      modules.map((m) => {
        const item = moduleToLayoutItem(m);
        if (FULL_BLEED_KEYS.has(m.module_key)) {
          item.x = 0;
          item.w = 2;
        }
        return item;
      }),
    [modules],
  );

  function handleLayoutChange(next: LayoutItem[]) {
    if (next.length !== modules.length) return;
    // Detecteer of er iets is veranderd; zo ja persist.
    let changed = false;
    const updated = modules.map((m) => {
      const it = next.find((n) => n.i === m.id);
      if (!it) return m;
      const fb = FULL_BLEED_KEYS.has(m.module_key);
      const nx = fb ? 0 : it.x;
      const nw = fb ? 2 : it.w;
      if (
        m.position_x !== nx ||
        m.position_y !== it.y ||
        m.w !== nw ||
        m.h !== it.h
      ) {
        changed = true;
      }
      return {
        ...m,
        position_x: nx,
        position_y: it.y,
        w: nw,
        h: it.h,
        size: whToSize(nw, it.h),
      };
    });
    if (!changed) return;
    setModules(updated);
    start(async () => {
      const res = await updateModuleLayout({
        tenant_id: tenantId,
        items: updated.map((m) => ({
          id: m.id,
          x: m.position_x,
          y: m.position_y,
          w: m.w,
          h: m.h,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        // Revert door router refresh.
        router.refresh();
      }
    });
  }

  function add(moduleKey: string, size: ModuleSize) {
    setError(null);
    start(async () => {
      const res = await addTenantModule({
        tenant_id: tenantId,
        module_key: moduleKey,
        size,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setModules((prev) => [...prev, res.data.module]);
      setAdding(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Module verwijderen?")) return;
    setModules((prev) => prev.filter((m) => m.id !== id));
    start(async () => {
      const res = await deleteTenantModule({ tenant_id: tenantId, module_id: id });
      if (!res.ok) setError(res.error);
    });
  }

  function patchModule(id: string, patch: Partial<TenantModule>) {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border" style={{ borderColor: "var(--surface-border)" }}>
          <button
            type="button"
            onClick={() => setPreviewMobile(false)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: !previewMobile ? "var(--accent)" : "transparent",
              color: "var(--text-primary)",
            }}
          >
            <Monitor className="h-3 w-3" /> Desktop
          </button>
          <button
            type="button"
            onClick={() => setPreviewMobile(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: previewMobile ? "var(--accent)" : "transparent",
              color: "var(--text-primary)",
            }}
          >
            <Smartphone className="h-3 w-3" /> Mobiel
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-4 w-4" /> Module toevoegen
        </button>
      </div>

      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Sleep en resize modules vrij in het 2-koloms grid. Hero-sliders staan
        altijd op volle breedte. Mobiel toont alles in 1 kolom.
      </p>

      {adding && (
        <ModuleAddDialog
          catalog={catalog}
          pending={pending}
          onClose={() => setAdding(false)}
          onAdd={add}
        />
      )}

      {error && (
        <p className="text-xs" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      {modules.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
          Nog geen modules. Voeg de eerste module toe om je homepage te bouwen.
        </p>
      ) : previewMobile ? (
        <div className="mx-auto grid w-full max-w-sm grid-cols-1 gap-3">
          {modules.map((m) => (
            <ModuleCard
              key={m.id}
              module={m}
              tenantId={tenantId}
              previewMobile
              pages={pages}
              open={openId === m.id}
              onToggleOpen={() => setOpenId((id) => (id === m.id ? null : m.id))}
              onPatch={(p) => patchModule(m.id, p)}
              onRemove={() => remove(m.id)}
            />
          ))}
        </div>
      ) : (
        <div
          className="rounded-lg border p-2"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-soft)" }}
        >
          <GridLayout
            className="layout"
            layout={layout}
            cols={COLS}
            rowHeight={ROW_HEIGHT}
            width={typeof window !== "undefined" ? Math.min(window.innerWidth - 64, 960) : 720}
            margin={[12, 12]}
            isResizable
            isDraggable
            compactType="vertical"
            preventCollision={false}
            draggableHandle=".module-drag-handle"
            onLayoutChange={(next) => handleLayoutChange(next as LayoutItem[])}
          >
            {modules.map((m) => (
              <div key={m.id}>
                <ModuleCard
                  module={m}
                  tenantId={tenantId}
                  previewMobile={false}
                  pages={pages}
                  open={openId === m.id}
                  onToggleOpen={() =>
                    setOpenId((id) => (id === m.id ? null : m.id))
                  }
                  onPatch={(p) => patchModule(m.id, p)}
                  onRemove={() => remove(m.id)}
                />
              </div>
            ))}
          </GridLayout>
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  module,
  tenantId,
  previewMobile,
  pages,
  open,
  onToggleOpen,
  onPatch,
  onRemove,
}: {
  module: TenantModule;
  tenantId: string;
  previewMobile: boolean;
  pages: PageOption[];
  open: boolean;
  onToggleOpen: () => void;
  onPatch: (p: Partial<TenantModule>) => void;
  onRemove: () => void;
}) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(module.title ?? "");

  function persist(patch: {
    title?: string | null;
    visible_for?: "public" | "logged_in";
    visible_mobile?: boolean;
  }) {
    start(async () => {
      await updateTenantModule({
        tenant_id: tenantId,
        module_id: module.id,
        ...patch,
      });
    });
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg border"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div
        className="module-drag-handle flex cursor-grab items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-soft)" }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title || module.module_key}
          </p>
          <p className="truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {module.module_key} • {module.w}×{module.h}
            {previewMobile && !module.visible_mobile ? " • verborgen op mobiel" : ""}
          </p>
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const v = !module.visible_mobile;
            onPatch({ visible_mobile: v });
            persist({ visible_mobile: v });
          }}
          title="Mobiel zichtbaar"
          className="rounded p-1.5"
          style={{ color: module.visible_mobile ? "var(--text-primary)" : "var(--text-secondary)" }}
        >
          {module.visible_mobile ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleOpen();
          }}
          className="rounded p-1.5"
          aria-label="Open editor"
        >
          {open ? (
            <ChevronUp className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          )}
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded p-1.5"
          aria-label="Verwijder"
        >
          <Trash2 className="h-4 w-4" style={{ color: "#dc2626" }} />
        </button>
      </div>

      {!open && (
        <div className="flex flex-1 items-center justify-center px-3 py-4 text-center">
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {FULL_BLEED_KEYS.has(module.module_key)
              ? "Volle breedte"
              : `${module.w} kolom × ${module.h} rij`}
          </p>
        </div>
      )}

      {open && (
        <div className="space-y-3 px-3 py-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Titel
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => persist({ title })}
                className="w-full rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Zichtbaar voor
              </span>
              <select
                value={module.visible_for}
                onChange={(e) => {
                  const v = e.target.value as "public" | "logged_in";
                  onPatch({ visible_for: v });
                  persist({ visible_for: v });
                }}
                disabled={module.module_key === "personal_dashboard"}
                className="w-full rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none disabled:opacity-50"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
              >
                <option value="public">Iedereen</option>
                <option value="logged_in">Alleen ingelogd</option>
              </select>
            </label>
          </div>

          <div className="rounded-lg border p-3" style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-soft)" }}>
            <p className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              <Settings2 className="h-3 w-3" /> Configuratie
            </p>
            <ModuleConfigEditor tenantId={tenantId} module={module} pages={pages} />
          </div>

          {pending && (
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Opslaan…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
