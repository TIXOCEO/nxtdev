"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  createMembershipPlanSchema,
  BILLING_PERIODS,
  type CreateMembershipPlanInput,
} from "@/lib/validation/membership-plans";
import { createMembershipPlan } from "@/lib/actions/tenant/members";

const BILLING_LABELS: Record<string, string> = {
  monthly: "Per maand",
  quarterly: "Per kwartaal",
  yearly: "Per jaar",
  custom: "Custom",
};

export interface NewPlanFormProps {
  tenantId: string;
}

type FormShape = {
  tenant_id: string;
  name: string;
  price: string;
  billing_period: (typeof BILLING_PERIODS)[number];
  is_active: boolean;
};

export function NewPlanForm({ tenantId }: NewPlanFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormShape>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createMembershipPlanSchema) as any,
    defaultValues: {
      tenant_id: tenantId,
      name: "",
      price: "",
      billing_period: "monthly",
      is_active: true,
    },
  });

  function onSubmit(values: FormShape) {
    setErr(null);
    startTransition(async () => {
      const res = await createMembershipPlan({
        ...values,
        tenant_id: tenantId,
      } as unknown as CreateMembershipPlanInput);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      reset({
        tenant_id: tenantId,
        name: "",
        price: "",
        billing_period: "monthly",
        is_active: true,
      });
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
      className="grid gap-3 sm:grid-cols-4"
      noValidate
    >
      <input type="hidden" {...register("tenant_id")} value={tenantId} />
      <div className="sm:col-span-2">
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
          placeholder="Bijv. Jeugd basis"
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
          Prijs (€)
        </label>
        <input
          inputMode="decimal"
          {...register("price")}
          className={inputCls}
          style={inputStyle}
          placeholder="0,00"
        />
        {errors.price && (
          <p className="mt-1 text-xs text-red-600">
            {String(errors.price.message)}
          </p>
        )}
      </div>
      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Periode
        </label>
        <select
          {...register("billing_period")}
          className={inputCls}
          style={inputStyle}
        >
          {BILLING_PERIODS.map((b) => (
            <option key={b} value={b}>
              {BILLING_LABELS[b]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 flex items-center gap-2">
        <input
          id="plan-active"
          type="checkbox"
          {...register("is_active")}
          className="h-4 w-4"
        />
        <label
          htmlFor="plan-active"
          className="text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          Actief en beschikbaar voor toewijzing
        </label>
      </div>
      {err && (
        <p className="sm:col-span-4 text-xs text-red-600" role="alert">
          {err}
        </p>
      )}
      <div className="sm:col-span-4 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-4 w-4" />{" "}
          {pending ? "Bezig…" : "Abonnement aanmaken"}
        </button>
      </div>
    </form>
  );
}
