"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, Trash2, Settings2, Eye, EyeOff, Smartphone, Monitor, ChevronDown, ChevronUp } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addTenantModule,
  deleteTenantModule,
  reorderTenantModules,
  updateTenantModule,
} from "@/lib/actions/tenant/homepage";
import type { ModuleCatalog, TenantModule } from "@/types/database";
import { ModuleConfigEditor } from "./module-config-editor";

interface Props {
  tenantId: string;
  initialModules: TenantModule[];
  catalog: ModuleCatalog[];
}

export function HomepageBuilder({ tenantId, initialModules, catalog }: Props) {
  const router = useRouter();
  const [modules, setModules] = useState<TenantModule[]>(initialModules);
  const [adding, setAdding] = useState(false);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = modules.findIndex((m) => m.id === active.id);
    const newIdx = modules.findIndex((m) => m.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(modules, oldIdx, newIdx).map((m, i) => ({
      ...m,
      position: i,
    }));
    setModules(next);
    start(async () => {
      const res = await reorderTenantModules({
        tenant_id: tenantId,
        ordered_ids: next.map((m) => m.id),
      });
      if (!res.ok) setError(res.error);
    });
  }

  function add(key: string) {
    setError(null);
    start(async () => {
      const res = await addTenantModule({ tenant_id: tenantId, module_key: key });
      if (!res.ok) {
        setError(res.error);
        return;
      }
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
          onClick={() => setAdding((s) => !s)}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-4 w-4" /> Module toevoegen
        </button>
      </div>

      {adding && (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-soft)" }}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Kies een module
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={pending}
                onClick={() => add(c.key)}
                className="rounded-lg border bg-white px-3 py-2 text-left text-xs hover:bg-black/5 disabled:opacity-50"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
              >
                <p className="font-semibold">{c.name}</p>
                {c.description && (
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {c.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
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
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {modules.map((m) => (
                <SortableRow
                  key={m.id}
                  module={m}
                  tenantId={tenantId}
                  previewMobile={previewMobile}
                  onRemove={() => remove(m.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableRow({
  module,
  tenantId,
  previewMobile,
  onRemove,
}: {
  module: TenantModule;
  tenantId: string;
  previewMobile: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
  });
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [size, setSize] = useState(module.size);
  const [visibleFor, setVisibleFor] = useState(module.visible_for);
  const [visibleMobile, setVisibleMobile] = useState(module.visible_mobile);
  const [title, setTitle] = useState(module.title ?? "");

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  function persist(patch: {
    title?: string | null;
    size?: "1x1" | "1x2" | "2x1";
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
    <li
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
      className="rounded-lg border"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab"
          aria-label="Sleep"
        >
          <GripVertical className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title || module.module_key}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {module.module_key} • {size} • {visibleFor === "logged_in" ? "Ingelogd" : "Publiek"}
            {previewMobile && !visibleMobile ? " • verborgen op mobiel" : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const v = !visibleMobile;
            setVisibleMobile(v);
            persist({ visible_mobile: v });
          }}
          title="Mobiel zichtbaar"
          className="rounded p-1.5"
          style={{ color: visibleMobile ? "var(--text-primary)" : "var(--text-secondary)" }}
        >
          {visibleMobile ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
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
          onClick={onRemove}
          className="rounded p-1.5"
          aria-label="Verwijder"
        >
          <Trash2 className="h-4 w-4" style={{ color: "#dc2626" }} />
        </button>
      </div>

      {open && (
        <div
          className="space-y-3 border-t px-3 py-3"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                Formaat
              </span>
              <select
                value={size}
                onChange={(e) => {
                  const v = e.target.value as "1x1" | "1x2" | "2x1";
                  setSize(v);
                  persist({ size: v });
                }}
                className="w-full rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
              >
                <option value="1x1">1x1 (halve breedte)</option>
                <option value="1x2">1x2 (halve breedte, dubbele hoogte)</option>
                <option value="2x1">2x1 (volle breedte)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Zichtbaar voor
              </span>
              <select
                value={visibleFor}
                onChange={(e) => {
                  const v = e.target.value as "public" | "logged_in";
                  setVisibleFor(v);
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
            <ModuleConfigEditor tenantId={tenantId} module={module} />
          </div>

          {pending && (
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Opslaan…
            </p>
          )}
        </div>
      )}
    </li>
  );
}
