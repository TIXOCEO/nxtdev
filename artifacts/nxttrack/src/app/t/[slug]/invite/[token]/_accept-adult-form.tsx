"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import {
  acceptAdultInviteSchema,
  type AcceptAdultInviteInput,
} from "@/lib/validation/invites";
import { acceptAdultInvite } from "@/lib/actions/tenant/invites";

export interface AcceptAdultInviteFormProps {
  token: string;
  email: string;
  defaultName: string;
  tenantSlug: string;
  accentColor: string;
}

const inputCls =
  "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";

export function AcceptAdultInviteForm({
  token,
  email,
  defaultName,
  tenantSlug,
  accentColor,
}: AcceptAdultInviteFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptAdultInviteInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(acceptAdultInviteSchema) as any,
    defaultValues: { token, full_name: defaultName, password: "" },
  });

  function onSubmit(values: AcceptAdultInviteInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await acceptAdultInvite({ ...values, token });
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      setDone(true);
      setTimeout(() => router.push(`/t/${tenantSlug}`), 1500);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-8 w-8" style={{ color: accentColor }} />
        <h2
          className="mt-2 text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Account aangemaakt
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Je kunt nu inloggen met {email}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Maak een wachtwoord aan om je account te activeren.
      </p>

      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          E-mail
        </label>
        <input
          value={email}
          readOnly
          className={inputCls}
          style={{
            backgroundColor: "var(--surface-soft)",
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Volledige naam *
        </label>
        <input
          {...register("full_name")}
          className={inputCls}
          style={{
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        />
        {errors.full_name && (
          <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>
        )}
      </div>

      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Wachtwoord *
        </label>
        <input
          type="password"
          autoComplete="new-password"
          {...register("password")}
          className={inputCls}
          style={{
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        />
        {errors.password && (
          <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p className="text-sm text-red-600" role="alert">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: accentColor, color: "#fff" }}
      >
        {pending ? "Bezig…" : "Account activeren"}
      </button>
    </form>
  );
}
