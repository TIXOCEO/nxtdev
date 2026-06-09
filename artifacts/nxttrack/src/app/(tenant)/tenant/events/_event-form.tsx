"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import {
  createTenantEventSchema,
  type CreateTenantEventInput,
} from "@/lib/validation/tenant-events";
import {
  createTenantEvent,
  updateTenantEvent,
} from "@/lib/actions/tenant/tenant-events";
import type { TenantEvent } from "@/lib/db/tenant-events";

export interface EventFormProps {
  mode: "create" | "edit";
  tenantId: string;
  initial?: TenantEvent;
  onDelete?: () => Promise<void>;
}

interface FormValues {
  tenant_id: string;
  status: "draft" | "published" | "archived";
  title: string;
  body: string;
  starts_at: string;
  ends_at: string;
  cta_label: string;
  cta_url: string;
  cover_image_url: string;
  is_featured: boolean;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toForm(tenantId: string, e?: TenantEvent): FormValues {
  return {
    tenant_id: tenantId,
    status: (e?.status as FormValues["status"]) ?? "draft",
    title: e?.title ?? "",
    body: e?.body ?? "",
    starts_at: toLocalInput(e?.starts_at ?? null),
    ends_at: toLocalInput(e?.ends_at ?? null),
    cta_label: e?.cta_label ?? "",
    cta_url: e?.cta_url ?? "",
    cover_image_url: e?.cover_image_url ?? "",
    is_featured: e?.is_featured ?? false,
  };
}

export function EventForm({ mode, tenantId, initial, onDelete }: EventFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createTenantEventSchema) as unknown as Resolver<FormValues>,
    defaultValues: toForm(tenantId, initial),
  });

  const onSubmit = (status: "draft" | "published") => {
    setValue("status", status);
    return handleSubmit((values) => {
      setServerError(null);
      startTransition(async () => {
        const payload: CreateTenantEventInput = {
          tenant_id: tenantId,
          title: values.title,
          body: values.body || null,
          starts_at: values.starts_at ? new Date(values.starts_at).toISOString() : null,
          ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
          cta_label: values.cta_label || null,
          cta_url: values.cta_url || null,
          cover_image_url: values.cover_image_url || null,
          is_featured: values.is_featured,
          status,
        };
        const res =
          mode === "create"
            ? await createTenantEvent(payload)
            : await updateTenantEvent(initial!.id, payload);
        if (!res.ok) {
          setServerError(res.error);
          return;
        }
        router.push("/tenant/events");
        router.refresh();
      });
    })();
  };

  return (
    <form className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Titel" error={errors.title?.message} className="sm:col-span-2">
          <Input {...register("title")} placeholder="Open dag 2026" />
        </Field>

        <Field label="Korte beschrijving" error={errors.body?.message} hint="Max 4000 tekens" className="sm:col-span-2">
          <textarea
            {...register("body")}
            rows={4}
            className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            style={{
              borderColor: "var(--shell-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--shell-panel-strong)",
            }}
            placeholder="Wat staat er op het programma?"
          />
        </Field>

        <Field label="Starttijd" error={errors.starts_at?.message}>
          <Input type="datetime-local" {...register("starts_at")} />
        </Field>
        <Field label="Eindtijd" error={errors.ends_at?.message}>
          <Input type="datetime-local" {...register("ends_at")} />
        </Field>

        <Field label="Knop-label" error={errors.cta_label?.message} hint="Optioneel">
          <Input {...register("cta_label")} placeholder="Aanmelden" />
        </Field>
        <Field label="Knop-URL" error={errors.cta_url?.message} hint="https:// of intern pad">
          <Input {...register("cta_url")} placeholder="/t/[slug]/inschrijven" />
        </Field>

        <Field label="Cover-afbeelding URL" error={errors.cover_image_url?.message} className="sm:col-span-2">
          <Input {...register("cover_image_url")} placeholder="https://…" />
        </Field>

        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            {...register("is_featured")}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            Uitgelicht op publieke homepage
          </span>
        </label>
      </div>

      {serverError && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "rgb(252 165 165)", backgroundColor: "rgb(254 242 242)", color: "rgb(153 27 27)" }}
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
                if (confirm("Event verwijderen? Dit kan niet ongedaan worden gemaakt.")) {
                  startTransition(async () => {
                    await onDelete();
                    router.push("/tenant/events");
                    router.refresh();
                  });
                }
              }}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> Verwijderen
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
            Annuleren
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onSubmit("draft")}
            className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--shell-border)", color: "var(--text-primary)" }}
          >
            Concept opslaan
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onSubmit("published")}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            {pending ? "Bezig…" : "Publiceren"}
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
        borderColor: "var(--shell-border)",
        color: "var(--text-primary)",
        backgroundColor: "var(--shell-panel-strong)",
      }}
    />
  );
}
