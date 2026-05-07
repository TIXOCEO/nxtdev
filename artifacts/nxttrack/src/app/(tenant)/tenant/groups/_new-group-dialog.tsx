"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  createGroupSchema,
  type CreateGroupInput,
} from "@/lib/validation/groups";
import { createGroup } from "@/lib/actions/tenant/members";

export interface NewGroupDialogProps {
  tenantId: string;
  triggerLabel?: string;
}

export function NewGroupDialog({
  tenantId,
  triggerLabel = "Nieuwe groep",
}: NewGroupDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
      max_athletes: null,
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
      reset({
        tenant_id: tenantId,
        name: "",
        description: "",
        max_members: null,
        max_athletes: null,
      });
      setOpen(false);
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setErr(null);
          reset({
            tenant_id: tenantId,
            name: "",
            description: "",
            max_members: null,
            max_athletes: null,
          });
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--text-primary)",
          }}
        >
          <Plus className="h-4 w-4" /> {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-w-md rounded-2xl border p-0 sm:max-w-md"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
          color: "var(--text-primary)",
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader className="border-b p-5" style={{ borderColor: "var(--surface-border)" }}>
            <DialogTitle className="text-base font-semibold">
              Nieuwe groep
            </DialogTitle>
            <DialogDescription
              className="text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Geef de groep een naam en (optioneel) een limiet op het totaal
              aantal leden of alleen het aantal atleten.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 p-5">
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
                autoFocus
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

            <div className="grid gap-3 sm:grid-cols-2">
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
                      v === "" || v == null
                        ? null
                        : Number.parseInt(String(v), 10),
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
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Max. atleten
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  {...register("max_athletes", {
                    setValueAs: (v) =>
                      v === "" || v == null
                        ? null
                        : Number.parseInt(String(v), 10),
                  })}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Onbeperkt"
                />
                {errors.max_athletes && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.max_athletes.message}
                  </p>
                )}
                <p
                  className="mt-1 text-[11px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Telt alleen leden met de rol atleet — trainers en staff vallen
                  hier buiten.
                </p>
              </div>
            </div>

            {err && (
              <p className="text-xs text-red-600" role="alert">
                {err}
              </p>
            )}
          </div>

          <DialogFooter
            className="flex flex-row items-center justify-end gap-2 border-t p-4"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-xl border px-3 text-sm font-medium"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
              >
                Annuleren
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--text-primary)",
              }}
            >
              <Plus className="h-4 w-4" />
              {pending ? "Bezig…" : "Groep aanmaken"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
