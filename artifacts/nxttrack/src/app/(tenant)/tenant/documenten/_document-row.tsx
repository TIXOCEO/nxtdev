"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ExternalLink, Archive, ArchiveRestore } from "lucide-react";
import {
  deleteTrainerDocument,
  updateTrainerDocument,
} from "@/lib/actions/tenant/trainer-documents";

interface Doc {
  id: string;
  title: string;
  category: string;
  file_url: string;
  is_archived: boolean;
}

export function DocumentRow({
  tenantId,
  doc,
  categoryLabel,
}: {
  tenantId: string;
  doc: Doc;
  categoryLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleArchive() {
    startTransition(async () => {
      await updateTrainerDocument(tenantId, {
        id: doc.id,
        is_archived: !doc.is_archived,
      });
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Verwijder "${doc.title}"?`)) return;
    startTransition(async () => {
      await deleteTrainerDocument(tenantId, doc.id);
      router.refresh();
    });
  }

  return (
    <tr className="border-b last:border-b-0" style={{ borderColor: "var(--surface-border)", opacity: doc.is_archived ? 0.55 : 1 }}>
      <td className="px-4 py-2.5">
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium hover:underline"
          style={{ color: "var(--text-primary)" }}
        >
          {doc.title}
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      </td>
      <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
        {categoryLabel}
      </td>
      <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
        {doc.is_archived ? "Gearchiveerd" : "Actief"}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={toggleArchive}
            disabled={pending}
            className="rounded-md p-1.5 hover:bg-black/[0.05]"
            title={doc.is_archived ? "Heractiveren" : "Archiveren"}
            style={{ color: "var(--text-secondary)" }}
          >
            {doc.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
          <button
            onClick={remove}
            disabled={pending}
            className="rounded-md p-1.5 hover:bg-black/[0.05]"
            title="Verwijderen"
            style={{ color: "#b91c1c" }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
