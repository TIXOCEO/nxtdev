"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, Upload } from "lucide-react";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import {
  createNewsPostSchema,
  type CreateNewsPostInput,
} from "@/lib/validation/news";
import {
  createNewsPost,
  updateNewsPost,
  uploadNewsCoverImage,
} from "@/lib/actions/tenant/news";
import type { NewsCategory, NewsPost } from "@/types/database";

export interface PostFormProps {
  mode: "create" | "edit";
  tenantId: string;
  categories: NewsCategory[];
  initial?: NewsPost;
  onDelete?: () => Promise<void>;
}

interface FormValues {
  tenant_id: string;
  status: "draft" | "published";
  title: string;
  slug: string;
  excerpt: string;
  category_id: string;
  cover_image_url: string;
  content_json: Record<string, unknown> | null;
  content_html: string;
}

function toForm(tenantId: string, p?: NewsPost): FormValues {
  return {
    tenant_id: tenantId,
    status: (p?.status as "draft" | "published" | undefined) ?? "draft",
    title: p?.title ?? "",
    slug: p?.slug ?? "",
    excerpt: p?.excerpt ?? "",
    category_id: p?.category_id ?? "",
    cover_image_url: p?.cover_image_url ?? "",
    content_json: (p?.content_json as Record<string, unknown> | null) ?? null,
    content_html: p?.content_html ?? "",
  };
}

export function PostForm({ mode, tenantId, categories, initial, onDelete }: PostFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createNewsPostSchema) as unknown as Resolver<FormValues>,
    defaultValues: toForm(tenantId, initial),
  });

  const coverUrl = watch("cover_image_url");

  const onSubmit = (status: "draft" | "published") => {
    setValue("status", status, { shouldValidate: false });
    return handleSubmit(
      (values) => {
        setServerError(null);
        startTransition(async () => {
          const payload: CreateNewsPostInput = {
            tenant_id: tenantId,
            title: values.title,
            slug: values.slug,
            excerpt: values.excerpt || null,
            category_id: values.category_id || null,
            cover_image_url: values.cover_image_url || null,
            status,
            content_json: values.content_json,
            content_html: values.content_html || null,
          };
          const res =
            mode === "create"
              ? await createNewsPost(payload)
              : await updateNewsPost(initial!.id, payload);
          if (!res.ok) {
            setServerError(res.error);
            return;
          }
          router.push("/tenant/news");
          router.refresh();
        });
      },
      (errs) => {
        const first = Object.values(errs).find((e) => e && (e as { message?: string }).message);
        setServerError(
          (first as { message?: string } | undefined)?.message ??
            "Please fix the highlighted fields and try again.",
        );
      },
    )();
  };

  const handleUpload = async (file: File) => {
    setServerError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("tenant_id", tenantId);
      fd.set("file", file);
      const res = await uploadNewsCoverImage(fd);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      setValue("cover_image_url", res.data.url, { shouldDirty: true });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Title" error={errors.title?.message}>
          <Input {...register("title")} placeholder="Big news!" />
        </Field>
        <Field label="Slug" error={errors.slug?.message} hint="lowercase, numbers, hyphens">
          <Input {...register("slug")} placeholder="big-news" />
        </Field>

        <Field label="Excerpt" error={errors.excerpt?.message} hint="Max 300 characters" className="sm:col-span-2">
          <textarea
            {...register("excerpt")}
            rows={2}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-main)",
            }}
            placeholder="Short summary…"
          />
        </Field>

        <Field label="Category" error={errors.category_id?.message}>
          <select
            {...register("category_id")}
            className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-main)",
            }}
          >
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Cover image" error={errors.cover_image_url?.message}>
          <div className="flex items-center gap-3">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt=""
                className="h-12 w-12 rounded-lg object-cover"
                style={{ borderColor: "var(--surface-border)" }}
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-lg border"
                style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-soft)" }}
              >
                <Upload className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
              </div>
            )}
            <label
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-black/5"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Uploading…" : coverUrl ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </Field>
      </div>

      <Field label="Content" error={errors.content_html?.message}>
        <Controller
          control={control}
          name="content_html"
          render={() => (
            <TiptapEditor
              initialJson={initial?.content_json as Record<string, unknown> | null}
              initialHtml={initial?.content_html ?? null}
              onChange={({ json, html }) => {
                setValue("content_json", json, { shouldDirty: true });
                setValue("content_html", html, { shouldDirty: true });
              }}
            />
          )}
        />
      </Field>

      {serverError && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "rgb(252 165 165)",
            backgroundColor: "rgb(254 242 242)",
            color: "rgb(153 27 27)",
          }}
        >
          {serverError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {mode === "edit" && onDelete && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm("Delete this post? This cannot be undone.")) {
                  startTransition(async () => {
                    await onDelete();
                    router.push("/tenant/news");
                    router.refresh();
                  });
                }
              }}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl px-4 py-2 text-sm font-medium hover:bg-black/5"
            style={{ color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onSubmit("draft")}
            className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onSubmit("published")}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            {pending ? "Saving…" : "Publish"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      {children}
      {hint && !error && (
        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </span>
      )}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-[var(--accent)]"
      style={{
        borderColor: "var(--surface-border)",
        color: "var(--text-primary)",
        backgroundColor: "var(--surface-main)",
      }}
    />
  );
}
