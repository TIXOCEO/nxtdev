"use client";

import { useState, useTransition } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  createTenantWithAdminSchema,
  updateTenantSchema,
  type CreateTenantWithAdminInput,
  type UpdateTenantInput,
} from "@/lib/validation/platform";
import {
  createTenant,
  updateTenant,
} from "@/lib/actions/platform/tenants";
import type { Tenant } from "@/types/database";
import { PasswordField } from "@/components/admin/password-field";

export interface TenantFormSectorOption {
  key: string;
  name: string;
}

export interface TenantFormProps {
  mode: "create" | "edit";
  initial?: Tenant;
  /** Beschikbare sector-templates voor de dropdown bij aanmaken. */
  sectorTemplates?: TenantFormSectorOption[];
}

type CreateValues = {
  name: string;
  slug: string;
  logo_url: string;
  primary_color: string;
  contact_email: string;
  domain: string;
  status: "active" | "inactive";
  sector_template_key: string;
  admin_email: string;
  admin_password: string;
  admin_full_name: string;
};

type EditValues = Omit<CreateValues, "admin_email" | "admin_password" | "admin_full_name">;

function tenantToForm(t?: Tenant): EditValues {
  return {
    name: t?.name ?? "",
    slug: t?.slug ?? "",
    logo_url: t?.logo_url ?? "",
    primary_color: t?.primary_color ?? "#b6d83b",
    contact_email: t?.contact_email ?? "",
    domain: t?.domain ?? "",
    status: t?.status === "inactive" ? "inactive" : "active",
    sector_template_key: t?.sector_template_key ?? "",
  };
}

export function TenantForm({ mode, initial, sectorTemplates = [] }: TenantFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const isCreate = mode === "create";
  const schema = isCreate ? createTenantWithAdminSchema : updateTenantSchema;

  const defaultValues: CreateValues = {
    ...tenantToForm(initial),
    admin_email: "",
    admin_password: "",
    admin_full_name: "",
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(schema) as unknown as Resolver<CreateValues>,
    defaultValues,
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      if (isCreate) {
        const payload: CreateTenantWithAdminInput = {
          name: values.name,
          slug: values.slug,
          logo_url: values.logo_url || null,
          primary_color: values.primary_color || "#b6d83b",
          contact_email: values.contact_email || null,
          domain: values.domain || null,
          status: values.status,
          sector_template_key: values.sector_template_key || null,
          admin_email: values.admin_email,
          admin_password: values.admin_password,
          admin_full_name: values.admin_full_name || "",
        };
        const res = await createTenant(payload);
        if (!res.ok) {
          setServerError(res.error);
          return;
        }
      } else {
        const payload: Omit<UpdateTenantInput, "id"> = {
          name: values.name,
          slug: values.slug,
          logo_url: values.logo_url || null,
          primary_color: values.primary_color || "#b6d83b",
          contact_email: values.contact_email || null,
          domain: values.domain || null,
          status: values.status,
          sector_template_key: values.sector_template_key || null,
        };
        const res = await updateTenant(initial!.id, payload);
        if (!res.ok) {
          setServerError(res.error);
          return;
        }
      }
      router.push("/platform/tenants");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Name" error={errors.name?.message}>
          <Input {...register("name")} placeholder="Voetbalschool Houtrust" />
        </Field>

        <Field label="Slug" error={errors.slug?.message} hint="lowercase, numbers, hyphens. Min 3 chars.">
          <Input {...register("slug")} placeholder="voetbalschool-houtrust" />
        </Field>

        <Field label="Logo URL" error={errors.logo_url?.message}>
          <Input {...register("logo_url")} placeholder="https://…" />
        </Field>

        <Field label="Primary color" error={errors.primary_color?.message}>
          <Input type="text" {...register("primary_color")} placeholder="#b6d83b" />
        </Field>

        <Field label="Contact email" error={errors.contact_email?.message}>
          <Input type="email" {...register("contact_email")} placeholder="info@example.com" />
        </Field>

        <Field label="Domain" error={errors.domain?.message}>
          <Input {...register("domain")} placeholder="example.com" />
        </Field>

        <Field label="Status" error={errors.status?.message}>
          <select
            {...register("status")}
            className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-main)",
            }}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>

        <Field
          label="Sector-template"
          error={errors.sector_template_key?.message}
          hint={
            isCreate
              ? "Bepaalt sector-default homepagemodules (auto-seed bij aanmaak) en woordenschat. Leeg = generic woordenschat-fallback en GEEN auto-seed van homepagemodules."
              : "Wijzigen heeft alleen effect op woordenschat; bestaande homepagemodules blijven. Seeden gebeurt via 'Sector & woordenschat' hieronder."
          }
        >
          <select
            {...register("sector_template_key")}
            className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-main)",
            }}
          >
            <option value="">— Geen (generic fallback) —</option>
            {sectorTemplates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name} ({t.key})
              </option>
            ))}
          </select>
        </Field>
      </div>

      {isCreate && (
        <div
          className="space-y-4 rounded-xl border p-4"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-subtle, transparent)" }}
        >
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Tenant master admin
            </h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Required. This account becomes the first tenant admin and can sign in immediately.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Admin email" error={errors.admin_email?.message}>
              <Input type="email" {...register("admin_email")} placeholder="admin@example.com" />
            </Field>

            <Field label="Full name" error={errors.admin_full_name?.message} hint="Optional">
              <Input type="text" {...register("admin_full_name")} placeholder="Jane Doe" />
            </Field>
          </div>

          <Field label="Admin password" error={errors.admin_password?.message}>
            <Controller
              control={control}
              name="admin_password"
              render={({ field }) => (
                <PasswordField value={field.value} onChange={field.onChange} />
              )}
            />
          </Field>
        </div>
      )}

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

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl px-4 py-2 text-sm font-medium hover:bg-black/5"
          style={{ color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          {pending ? "Saving…" : isCreate ? "Create tenant" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
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
      className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none transition-colors focus:border-[var(--accent)]"
      style={{
        borderColor: "var(--surface-border)",
        color: "var(--text-primary)",
        backgroundColor: "var(--surface-main)",
      }}
    />
  );
}
