"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Save, X } from "lucide-react";
import {
  updateMasterAdminSchema,
  type UpdateMasterAdminInput,
} from "@/lib/validation/platform";
import { updateTenantMasterAdmin } from "@/lib/actions/platform/tenants";
import { PasswordField } from "@/components/admin/password-field";

export interface MasterAdminCardProps {
  tenantId: string;
  currentEmail: string | null;
  currentName: string | null;
}

type FormValues = {
  tenant_id: string;
  email: string;
  password: string;
};

export function MasterAdminCard({
  tenantId,
  currentEmail,
  currentName,
}: MasterAdminCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(updateMasterAdminSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      tenant_id: tenantId,
      email: currentEmail ?? "",
      password: "",
    },
  });

  function startEdit() {
    setServerError(null);
    setSuccess(null);
    reset({
      tenant_id: tenantId,
      email: currentEmail ?? "",
      password: "",
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setServerError(null);
    reset({
      tenant_id: tenantId,
      email: currentEmail ?? "",
      password: "",
    });
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    setSuccess(null);
    startTransition(async () => {
      // Only send fields that actually changed / were filled.
      const payload: UpdateMasterAdminInput = {
        tenant_id: tenantId,
        email:
          values.email && values.email !== (currentEmail ?? "")
            ? values.email
            : undefined,
        password: values.password ? values.password : undefined,
      };
      const res = await updateTenantMasterAdmin(payload);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      setSuccess("Master admin credentials updated.");
      setEditing(false);
      router.refresh();
    });
  });

  if (!currentEmail) {
    return (
      <div
        className="rounded-2xl border p-6 text-sm"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
          color: "var(--text-secondary)",
        }}
      >
        This tenant has no master admin yet. (Tenants created before this
        feature shipped may need one assigned.)
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border p-6"
      style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {currentName ?? "Master admin"}
          </p>
          <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
            {currentEmail}
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-black/5"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Update
          </button>
        ) : (
          <button
            type="button"
            onClick={cancelEdit}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-black/5"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email" error={errors.email?.message}>
          <input
            type="email"
            {...register("email")}
            disabled={!editing}
            placeholder="admin@example.com"
            className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none transition-colors focus:border-[var(--accent)] disabled:opacity-60"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-main)",
            }}
          />
        </Field>

        <Field
          label="New password"
          error={errors.password?.message}
          hint={editing ? "Leave blank to keep the current password." : undefined}
        >
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <PasswordField
                value={field.value}
                onChange={field.onChange}
                disabled={!editing}
                placeholder={editing ? "" : "••••••••••••"}
              />
            )}
          />
        </Field>
      </div>

      {serverError && (
        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: "rgb(252 165 165)",
            backgroundColor: "rgb(254 242 242)",
            color: "rgb(153 27 27)",
          }}
        >
          {serverError}
        </div>
      )}
      {success && !editing && (
        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: "rgb(167 243 208)",
            backgroundColor: "rgb(236 253 245)",
            color: "rgb(6 95 70)",
          }}
        >
          {success}
        </div>
      )}

      {editing && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
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
