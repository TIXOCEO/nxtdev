"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  tenantProfileSchema,
  updateTenantProfile,
  type TenantProfileInput,
} from "@/lib/actions/tenant/profile";
import type { Tenant } from "@/types/database";

export interface ProfileFormProps {
  tenant: Tenant;
}

interface FormValues {
  name: string;
  logo_url: string;
  primary_color: string;
  contact_email: string;
  domain: string;
}

export function ProfileForm({ tenant }: ProfileFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(tenantProfileSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      name: tenant.name,
      logo_url: tenant.logo_url ?? "",
      primary_color: tenant.primary_color ?? "#b6d83b",
      contact_email: tenant.contact_email ?? "",
      domain: tenant.domain ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    setSuccess(null);
    startTransition(async () => {
      const payload: TenantProfileInput = {
        id: tenant.id,
        name: values.name,
        logo_url: values.logo_url || null,
        primary_color: values.primary_color || "#b6d83b",
        contact_email: values.contact_email || null,
        domain: values.domain || null,
      };
      const res = await updateTenantProfile(payload);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      setSuccess("Profile updated.");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Name" error={errors.name?.message}>
          <Input {...register("name")} />
        </Field>
        <Field label="Logo URL" error={errors.logo_url?.message}>
          <Input {...register("logo_url")} placeholder="https://…" />
        </Field>
        <Field label="Primary color" error={errors.primary_color?.message}>
          <Input {...register("primary_color")} placeholder="#b6d83b" />
        </Field>
        <Field label="Contact email" error={errors.contact_email?.message}>
          <Input type="email" {...register("contact_email")} placeholder="info@example.com" />
        </Field>
        <Field label="Domain" error={errors.domain?.message} className="sm:col-span-2">
          <Input {...register("domain")} placeholder="example.com" />
        </Field>
      </div>

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
      {success && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "rgb(167 243 208)",
            backgroundColor: "rgb(236 253 245)",
            color: "rgb(6 95 70)",
          }}
        >
          {success}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      {children}
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
