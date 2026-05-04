"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TiptapEditorOutput {
  json: Record<string, unknown>;
  html: string;
}

export interface TiptapEditorProps {
  initialJson?: Record<string, unknown> | null;
  initialHtml?: string | null;
  placeholder?: string;
  onChange?: (out: TiptapEditorOutput) => void;
  className?: string;
}

export function TiptapEditor({
  initialJson,
  initialHtml,
  placeholder = "Write your post…",
  onChange,
  className,
}: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
      Image,
    ],
    content: initialJson ?? initialHtml ?? "",
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[240px] px-4 py-3",
      },
    },
    onUpdate({ editor }) {
      onChange?.({
        json: editor.getJSON() as unknown as Record<string, unknown>,
        html: editor.getHTML(),
      });
    },
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return (
      <div
        className={cn("rounded-xl border", className)}
        style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-main)" }}
      >
        <div className="h-[240px] animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-hidden rounded-xl border", className)}
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-main)",
      }}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const items: Array<{
    icon: typeof Bold;
    label: string;
    onClick: () => void;
    isActive?: boolean;
  }> = [
    {
      icon: Bold,
      label: "Bold",
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive("bold"),
    },
    {
      icon: Italic,
      label: "Italic",
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive("italic"),
    },
    {
      icon: Heading2,
      label: "Heading",
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive("heading", { level: 2 }),
    },
    {
      icon: List,
      label: "Bullet list",
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive("bulletList"),
    },
    {
      icon: ListOrdered,
      label: "Numbered list",
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive("orderedList"),
    },
    {
      icon: Quote,
      label: "Quote",
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive("blockquote"),
    },
    {
      icon: LinkIcon,
      label: "Link",
      onClick: () => {
        const previous = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("URL", previous ?? "https://");
        if (url === null) return;
        if (url === "") {
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
          return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      },
      isActive: editor.isActive("link"),
    },
    {
      icon: Eraser,
      label: "Clear formatting",
      onClick: () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
    },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-soft)",
      }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onClick}
          aria-label={it.label}
          title={it.label}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-black/5",
            it.isActive && "shadow-sm",
          )}
          style={
            it.isActive
              ? { backgroundColor: "var(--accent)", color: "var(--text-primary)" }
              : { color: "var(--text-secondary)" }
          }
        >
          <it.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
