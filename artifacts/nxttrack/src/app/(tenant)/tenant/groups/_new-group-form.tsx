"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  createGroupSchema,
  type CreateGroupInput,
} from "@/lib/validation/groups";
import { createGroup } from "@/lib/actions/tenant/members";

export interface NewGroupFormProps {
  tenantId: string;
}

export function NewGroupForm({ tenantId }: NewGroupFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateGroupInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createGroupSchema) as any,
    defaultValues: {
      tenant_id: tenantId,
      name: "",
      description: "",
      max_members: null,
    },
  });

  function onSubmit(values: CreateGroupInput) {
    setErr(null);
    startTransition(async () => {
      const res = await createGroup({ ...values, tenant_id: tenantId });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      reset({ tenant_id: tenantId, name: "", description: "", max_members: null });
      router.refresh();
    });
  }

  const inputCls =
    "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";
  const inputStyle = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  } as const;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-3 sm:grid-cols-3"
      noValidate
    >
      <input type="hidden" {...register("tenant_id")} value={tenantId} />
      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Naam *
        </label>
        <input
          {...register("name")}
          className={inputCls}
          style={inputStyle}
          placeholder="Bijv. JO11-1"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
        )}
      </div>
      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Omschrijving
        </label>
        <input
          {...register("description")}
          className={inputCls}
          style={inputStyle}
          placeholder="Optioneel"
        />
      </div>
      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Max. leden
        </label>
        <input
          type="number"
          min={1}
          step={1}
          {...register("max_members", {
            setValueAs: (v) =>
              v === "" || v == null ? null : Number.parseInt(String(v), 10),
          })}
          className={inputCls}
          style={inputStyle}
          placeholder="Onbeperkt"
        />
        {errors.max_members && (
          <p className="mt-1 text-xs text-red-600">
            {errors.max_members.message}
          </p>
        )}
      </div>
      {err && (
        <p className="sm:col-span-3 text-xs text-red-600" role="alert">
          {err}
        </p>
      )}
      <div className="sm:col-span-3 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-4 w-4" /> {pending ? "Bezig…" : "Groep aanmaken"}
        </button>
      </div>
    </form>
  );
}
