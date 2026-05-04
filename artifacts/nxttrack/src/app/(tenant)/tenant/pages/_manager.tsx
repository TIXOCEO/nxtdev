"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ChevronRight,
  Plus,
  Save,
  Trash2,
  X,
  Lock,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import {
  upsertCustomPage,
  deleteCustomPage,
  toggleCustomPageFlag,
  reorderCustomPages,
} from "@/lib/actions/tenant/custom-pages";

interface PageVM {
  id: string;
  parent_id: string | null;
  title: string;
  slug: string;
  content_html: string;
  requires_auth: boolean;
  is_enabled: boolean;
  show_in_menu: boolean;
  sort_order: number;
}

interface Editor {
  id?: string;
  parent_id: string | null;
  title: string;
  slug: string;
  content_html: string;
  requires_auth: boolean;
  is_enabled: boolean;
  show_in_menu: boolean;
  sort_order: number;
}

function blank(parentId: string | null): Editor {
  return {
    parent_id: parentId,
    title: "",
    slug: "",
    content_html: "",
    requires_auth: false,
    is_enabled: true,
    show_in_menu: true,
    sort_order: 0,
  };
}

interface Props {
  tenantId: string;
  pages: PageVM[];
}

export function CustomPagesManager({ tenantId, pages: initialPages }: Props) {
  const [pages, setPages] = useState<PageVM[]>(initialPages);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const tree = useMemo(() => {
    const byParent = new Map<string | null, PageVM[]>();
    for (const p of pages) {
      const arr = byParent.get(p.parent_id) ?? [];
      arr.push(p);
      byParent.set(p.parent_id, arr);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    }
    return byParent;
  }, [pages]);

  function save() {
    if (!editor) return;
    setMsg(null);
    start(async () => {
      const res = await upsertCustomPage({
        id: editor.id,
        tenant_id: tenantId,
        parent_id: editor.parent_id,
        title: editor.title,
        slug: editor.slug,
        content_html: editor.content_html,
        requires_auth: editor.requires_auth,
        is_enabled: editor.is_enabled,
        show_in_menu: editor.show_in_menu,
        sort_order: editor.sort_order,
      });
      if (!res.ok) return setMsg(res.error);
      setMsg("Opgeslagen.");
      setEditor(null);
      // Optimistic local update for new entries
      if (!editor.id && res.ok) {
        setPages((prev) => [
          ...prev,
          {
            id: res.data.id,
            parent_id: editor.parent_id,
            title: editor.title,
            slug: editor.slug,
            content_html: editor.content_html,
            requires_auth: editor.requires_auth,
            is_enabled: editor.is_enabled,
            show_in_menu: editor.show_in_menu,
            sort_order: editor.sort_order,
          },
        ]);
      } else if (editor.id) {
        setPages((prev) =>
          prev.map((p) =>
            p.id === editor.id
              ? {
                  ...p,
                  parent_id: editor.parent_id,
                  title: editor.title,
                  slug: editor.slug,
                  content_html: editor.content_html,
                  requires_auth: editor.requires_auth,
                  is_enabled: editor.is_enabled,
                  show_in_menu: editor.show_in_menu,
                  sort_order: editor.sort_order,
                }
              : p,
          ),
        );
      }
    });
  }

  function remove(p: PageVM) {
    if (!confirm(`Verwijder pagina "${p.title}"? Eventuele subpagina's worden ook verwijderd.`)) return;
    setMsg(null);
    start(async () => {
      const res = await deleteCustomPage({ tenant_id: tenantId, id: p.id });
      if (res.ok) {
        setPages((prev) => prev.filter((x) => x.id !== p.id && x.parent_id !== p.id));
        setMsg("Verwijderd.");
      } else setMsg(res.error);
    });
  }

  function toggle(p: PageVM, field: "is_enabled" | "show_in_menu" | "requires_auth") {
    const next = !p[field];
    setPages((prev) => prev.map((x) => (x.id === p.id ? { ...x, [field]: next } : x)));
    start(async () => {
      const res = await toggleCustomPageFlag({
        tenant_id: tenantId,
        id: p.id,
        field,
        value: next,
      });
      if (!res.ok) {
        setMsg(res.error);
        // revert
        setPages((prev) => prev.map((x) => (x.id === p.id ? { ...x, [field]: !next } : x)));
      }
    });
  }

  function reorderSiblings(parentId: string | null, ids: string[]) {
    setPages((prev) => {
      const next = prev.map((p) => ({ ...p }));
      ids.forEach((id, idx) => {
        const row = next.find((p) => p.id === id);
        if (row) row.sort_order = idx;
      });
      return next;
    });
    start(async () => {
      const res = await reorderCustomPages({ tenant_id: tenantId, parent_id: parentId, ids });
      if (!res.ok) setMsg(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div
          className="rounded-xl border px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-secondary)",
          }}
        >
          {msg}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Sleep met de greep om de volgorde aan te passen. Klik op een pagina om te bewerken.
        </p>
        <button
          type="button"
          onClick={() => setEditor(blank(null))}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-3 w-3" /> Nieuwe pagina
        </button>
      </div>

      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <SortableLevel
          parentId={null}
          rows={tree.get(null) ?? []}
          tree={tree}
          depth={0}
          onEdit={(p) => setEditor({ ...p })}
          onAddChild={(parentId) => setEditor(blank(parentId))}
          onDelete={remove}
          onToggle={toggle}
          onReorder={reorderSiblings}
        />
      </div>

      {pages.length === 0 && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nog geen pagina&apos;s. Klik op &quot;Nieuwe pagina&quot; om je eerste menu-item te maken.
        </p>
      )}

      {editor && (
        <PageEditor
          editor={editor}
          onChange={setEditor}
          onSave={save}
          onClose={() => setEditor(null)}
          pending={pending}
          potentialParents={pages.filter((p) => p.parent_id === null && p.id !== editor.id)}
        />
      )}
    </div>
  );
}

function SortableLevel({
  parentId,
  rows,
  tree,
  depth,
  onEdit,
  onAddChild,
  onDelete,
  onToggle,
  onReorder,
}: {
  parentId: string | null;
  rows: PageVM[];
  tree: Map<string | null, PageVM[]>;
  depth: number;
  onEdit: (p: PageVM) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (p: PageVM) => void;
  onToggle: (p: PageVM, f: "is_enabled" | "show_in_menu" | "requires_auth") => void;
  onReorder: (parentId: string | null, ids: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(rows, oldIndex, newIndex).map((r) => r.id);
    onReorder(parentId, next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <ul>
          {rows.map((p) => (
            <SortableRow
              key={p.id}
              page={p}
              depth={depth}
              tree={tree}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onToggle={onToggle}
              onReorder={onReorder}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  page,
  depth,
  tree,
  onEdit,
  onAddChild,
  onDelete,
  onToggle,
  onReorder,
}: {
  page: PageVM;
  depth: number;
  tree: Map<string | null, PageVM[]>;
  onEdit: (p: PageVM) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (p: PageVM) => void;
  onToggle: (p: PageVM, f: "is_enabled" | "show_in_menu" | "requires_auth") => void;
  onReorder: (parentId: string | null, ids: string[]) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const children = tree.get(page.id) ?? [];

  return (
    <li ref={setNodeRef} style={style} className="border-b last:border-b-0" data-border>
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{
          paddingLeft: `${12 + depth * 20}px`,
          borderColor: "var(--surface-border)",
          opacity: page.is_enabled ? 1 : 0.55,
        }}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-[var(--text-secondary)] hover:bg-black/5 active:cursor-grabbing"
          aria-label="Verplaats"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {depth === 0 && children.length > 0 && (
          <ChevronRight className="h-3 w-3" style={{ color: "var(--text-secondary)" }} />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {page.title}
          </p>
          <p className="truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
            /{page.slug}
            {page.requires_auth && (
              <span className="ml-2 inline-flex items-center gap-0.5">
                <Lock className="h-2.5 w-2.5" /> alleen ingelogd
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onToggle(page, "is_enabled")}
          title={page.is_enabled ? "Aan — klik om uit te zetten" : "Uit — klik om aan te zetten"}
          className="rounded-lg p-1.5 text-xs transition-colors hover:bg-black/5"
          style={{ color: page.is_enabled ? "#16a34a" : "var(--text-secondary)" }}
        >
          {page.is_enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>

        {depth === 0 && (
          <button
            type="button"
            onClick={() => onAddChild(page.id)}
            title="Subpagina toevoegen"
            className="rounded-lg p-1.5 text-xs transition-colors hover:bg-black/5"
            style={{ color: "var(--text-secondary)" }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => onEdit(page)}
          title="Bewerken"
          className="rounded-lg p-1.5 text-xs transition-colors hover:bg-black/5"
          style={{ color: "var(--text-secondary)" }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onDelete(page)}
          title="Verwijderen"
          className="rounded-lg p-1.5 text-xs transition-colors hover:bg-black/5"
          style={{ color: "#b91c1c" }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {children.length > 0 && depth === 0 && (
        <SortableLevel
          parentId={page.id}
          rows={children}
          tree={tree}
          depth={depth + 1}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onToggle={onToggle}
          onReorder={onReorder}
        />
      )}
    </li>
  );
}

function PageEditor({
  editor,
  onChange,
  onSave,
  onClose,
  pending,
  potentialParents,
}: {
  editor: Editor;
  onChange: (e: Editor) => void;
  onSave: () => void;
  onClose: () => void;
  pending: boolean;
  potentialParents: PageVM[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="flex w-full max-w-2xl max-h-[90vh] flex-col gap-4 overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {editor.id ? "Pagina bewerken" : "Nieuwe pagina"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-black/5"
            style={{ color: "var(--text-secondary)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto px-5">
          <Field label="Titel">
            <input
              value={editor.title}
              onChange={(e) => onChange({ ...editor, title: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: "var(--surface-soft)",
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>
          <Field label="Slug" hint="Alleen letters, cijfers en streepjes. Bv. 'over-ons'.">
            <input
              value={editor.slug}
              onChange={(e) =>
                onChange({
                  ...editor,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                })
              }
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: "var(--surface-soft)",
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>
          <Field label="Onder hoofdmenu">
            <select
              value={editor.parent_id ?? ""}
              onChange={(e) =>
                onChange({ ...editor, parent_id: e.target.value || null })
              }
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: "var(--surface-soft)",
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">— Hoofdmenu —</option>
              {potentialParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inhoud">
            <RichTextEditor
              value={editor.content_html}
              onChange={(html) => onChange({ ...editor, content_html: html })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Toggle
              label="Aan"
              value={editor.is_enabled}
              onChange={(v) => onChange({ ...editor, is_enabled: v })}
            />
            <Toggle
              label="In menu"
              value={editor.show_in_menu}
              onChange={(v) => onChange({ ...editor, show_in_menu: v })}
            />
            <Toggle
              label="Alleen ingelogd"
              value={editor.requires_auth}
              onChange={(v) => onChange({ ...editor, requires_auth: v })}
            />
          </div>
        </div>
        <div
          className="flex items-center justify-end gap-2 border-t px-5 py-3"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !editor.title.trim() || !editor.slug.trim()}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Save className="h-3 w-3" /> Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
      style={{
        backgroundColor: value ? "var(--accent)" : "var(--surface-soft)",
        borderColor: "var(--surface-border)",
        color: value ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      <span className="font-semibold">{label}</span>
      <span
        className="ml-2 h-3.5 w-3.5 rounded-full border"
        style={{
          backgroundColor: value ? "var(--text-primary)" : "transparent",
          borderColor: value ? "var(--text-primary)" : "var(--surface-border)",
        }}
      />
    </button>
  );
}
