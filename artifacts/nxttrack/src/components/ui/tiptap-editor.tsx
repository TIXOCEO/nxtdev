"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Code,
} from "lucide-react";
import { useCallback, useEffect } from "react";

export interface TipTapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
}

export function TipTapEditor({
  value,
  onChange,
  placeholder,
  minHeight = 280,
  disabled = false,
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: false, HTMLAttributes: { class: "tiptap-img" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "Begin met typen..." }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "tiptap-content prose prose-sm max-w-none focus:outline-none px-4 py-3",
        style: `min-height:${minHeight}px;`,
      },
    },
  });

  // Sync external value changes (e.g. after server save / tag insertion).
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className="rounded-xl border"
        style={{
          borderColor: "var(--surface-border)",
          backgroundColor: "var(--surface-main)",
          minHeight,
        }}
      />
    );
  }

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-main)",
      }}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <style>{`
        .tiptap-content { color: var(--text-primary); }
        .tiptap-content p { margin: 0 0 .6em; }
        .tiptap-content h1 { font-size: 1.6em; font-weight: 700; margin: .5em 0 .3em; }
        .tiptap-content h2 { font-size: 1.3em; font-weight: 700; margin: .5em 0 .3em; }
        .tiptap-content h3 { font-size: 1.1em; font-weight: 700; margin: .4em 0 .2em; }
        .tiptap-content ul { list-style: disc; padding-left: 1.4em; margin: 0 0 .6em; }
        .tiptap-content ol { list-style: decimal; padding-left: 1.4em; margin: 0 0 .6em; }
        .tiptap-content blockquote {
          border-left: 3px solid var(--surface-border);
          padding-left: .8em;
          color: var(--text-secondary);
          margin: .5em 0;
        }
        .tiptap-content a { color: var(--accent); text-decoration: underline; }
        .tiptap-content img.tiptap-img { max-width: 100%; height: auto; border-radius: 8px; }
        .tiptap-content code {
          background: var(--surface-soft);
          padding: 1px 4px;
          border-radius: 4px;
          font-size: .9em;
        }
        .tiptap-content [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: var(--text-secondary);
          opacity: .55;
          pointer-events: none;
          float: left;
        }
        .tiptap-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: var(--text-secondary);
          opacity: .55;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL (laat leeg om te verwijderen)", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  const addImage = useCallback(() => {
    const url = window.prompt("Afbeelding URL", "https://");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1.5"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-soft)",
      }}
    >
      <BtnGroup>
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Vet"><BoldIcon className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Cursief"><ItalicIcon className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Onderstreept"><UnderlineIcon className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Doorhalen"><Strikethrough className="h-3.5 w-3.5" /></Btn>
      </BtnGroup>
      <Sep />
      <BtnGroup>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Kop 1"><Heading1 className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Kop 2"><Heading2 className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Kop 3"><Heading3 className="h-3.5 w-3.5" /></Btn>
      </BtnGroup>
      <Sep />
      <BtnGroup>
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lijst"><List className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Genummerd"><ListOrdered className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Citaat"><Quote className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Code"><Code className="h-3.5 w-3.5" /></Btn>
      </BtnGroup>
      <Sep />
      <BtnGroup>
        <Btn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Links uitlijnen"><AlignLeft className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centreren"><AlignCenter className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Rechts uitlijnen"><AlignRight className="h-3.5 w-3.5" /></Btn>
      </BtnGroup>
      <Sep />
      <BtnGroup>
        <Btn onClick={setLink} active={editor.isActive("link")} title="Link"><LinkIcon className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={addImage} title="Afbeelding"><ImageIcon className="h-3.5 w-3.5" /></Btn>
      </BtnGroup>
      <Sep />
      <BtnGroup>
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Ongedaan maken"><Undo2 className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Opnieuw"><Redo2 className="h-3.5 w-3.5" /></Btn>
      </BtnGroup>
    </div>
  );
}

function BtnGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Sep() {
  return (
    <span
      className="mx-1 h-5 w-px"
      style={{ backgroundColor: "var(--surface-border)" }}
    />
  );
}

function Btn({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-30"
      style={{
        backgroundColor: active ? "var(--accent)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      {children}
    </button>
  );
}
