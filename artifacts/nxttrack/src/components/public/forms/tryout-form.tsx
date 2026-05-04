"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  publicTryoutSchema,
  type PublicTryoutInput,
} from "@/lib/validation/public-registration";
import { submitTryoutRegistration } from "@/lib/actions/public/registrations";
import { DateSelectField } from "./date-select-field";
import { PlayerTypeSelect } from "./player-type-select";
import { TermsCheckbox } from "./terms-checkbox";

export interface TryoutFormProps {
  tenantSlug: string;
}

type FormValues = {
  tenant_slug: string;
  registration_target: "self" | "child";
  full_name: string;
  child_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  player_type: "" | "player" | "goalkeeper";
  extra_details: string;
  agreed_terms: boolean;
};

const DEFAULTS = (slug: string): FormValues => ({
  tenant_slug: slug,
  registration_target: "self",
  full_name: "",
  child_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  player_type: "",
  extra_details: "",
  agreed_terms: false,
});

export function TryoutForm({ tenantSlug }: TryoutFormProps) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(publicTryoutSchema) as unknown as Resolver<FormValues>,
    defaultValues: DEFAULTS(tenantSlug),
  });

  const target = watch("registration_target");

  const onSubmit = handleSubmit(
    (values) => {
      setServerError(null);
      startTransition(async () => {
        const payload = {
          tenant_slug: tenantSlug,
          registration_target: values.registration_target,
          full_name: values.full_name,
          child_name: values.child_name || null,
          email: values.email,
          phone: values.phone,
          date_of_birth: values.date_of_birth,
          player_type: values.player_type as "player" | "goalkeeper",
          extra_details: values.extra_details || null,
          agreed_terms: true as const,
        } satisfies PublicTryoutInput;
        const res = await submitTryoutRegistration(payload);
        if (!res.ok) {
          setServerError(res.error);
          return;
        }
        setSuccess(true);
        reset(DEFAULTS(tenantSlug));
      });
    },
    (errs) => {
      const first = Object.values(errs).find(
        (e) => e && (e as { message?: string }).message,
      );
      setServerError(
        (first as { message?: string } | undefined)?.message ??
          "Controleer de gemarkeerde velden.",
      );
    },
  );

  if (success) {
    return (
      <SuccessPanel
        message="Bedankt! Je proeflesaanvraag is ontvangen. We nemen zo snel mogelijk contact met je op."
        onAnother={() => setSuccess(false)}
      />
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-[var(--radius-nxt-lg)] border p-5 sm:p-6"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
        boxShadow: "var(--shadow-app)",
      }}
    >
      <Field label="Voor wie is deze aanvraag?" error={errors.registration_target?.message}>
        <TargetToggle
          value={target}
          onChange={(v) => setValue("registration_target", v, { shouldValidate: false })}
          selfLabel="Ik schrijf mezelf in"
          childLabel="Ik schrijf mijn kind in"
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label={target === "child" ? "Naam ouder/verzorger" : "Volledige naam"}
          error={errors.full_name?.message}
        >
          <Input {...register("full_name")} autoComplete="name" />
        </Field>

        {target === "child" && (
          <Field label="Naam kind" error={errors.child_name?.message}>
            <Input {...register("child_name")} />
          </Field>
        )}

        <Field label="E-mail" error={errors.email?.message}>
          <Input type="email" {...register("email")} autoComplete="email" />
        </Field>
        <Field label="Telefoon" error={errors.phone?.message}>
          <Input type="tel" {...register("phone")} autoComplete="tel" placeholder="+31 6 12 34 56 78" />
        </Field>

        <Field
          label={target === "child" ? "Geboortedatum kind" : "Geboortedatum"}
          error={errors.date_of_birth?.message}
        >
          <Controller
            control={control}
            name="date_of_birth"
            render={({ field }) => (
              <DateSelectField value={field.value} onChange={field.onChange} disabled={pending} />
            )}
          />
        </Field>

        <Field label="Type speler" error={errors.player_type?.message}>
          <Controller
            control={control}
            name="player_type"
            render={({ field }) => (
              <PlayerTypeSelect
                value={field.value}
                onChange={(v) => field.onChange(v)}
                disabled={pending}
              />
            )}
          />
        </Field>
      </div>

      <Field
        label="Extra details"
        hint="Optioneel · max 1500 tekens"
        error={errors.extra_details?.message}
      >
        <textarea
          {...register("extra_details")}
          rows={4}
          maxLength={1500}
          placeholder="Bijvoorbeeld huidige club, ervaring, of een vraag."
          className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--tenant-accent)]"
          style={{
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
            backgroundColor: "var(--surface-main)",
          }}
        />
      </Field>

      <Controller
        control={control}
        name="agreed_terms"
        render={({ field }) => (
          <div>
            <TermsCheckbox checked={field.value} onChange={field.onChange} disabled={pending} />
            {errors.agreed_terms?.message && (
              <p className="mt-1 text-[11px] text-red-600">{errors.agreed_terms.message}</p>
            )}
          </div>
        )}
      />

      {serverError && <ErrorBanner>{serverError}</ErrorBanner>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ backgroundColor: "var(--tenant-accent)", color: "var(--text-primary)" }}
        >
          <Send className="h-4 w-4" />
          {pending ? "Versturen…" : "Aanvraag versturen"}
        </button>
      </div>
    </form>
  );
}

// ── shared local atoms (kept local to avoid extra files) ────────────

export function TargetToggle({
  value,
  onChange,
  selfLabel,
  childLabel,
}: {
  value: "self" | "child";
  onChange: (v: "self" | "child") => void;
  selfLabel: string;
  childLabel: string;
}) {
  const opts: Array<{ value: "self" | "child"; label: string }> = [
    { value: "self", label: selfLabel },
    { value: "child", label: childLabel },
  ];
  return (
    <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {opts.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors"
            style={{
              borderColor: active ? "var(--tenant-accent)" : "var(--surface-border)",
              backgroundColor: active
                ? "color-mix(in srgb, var(--tenant-accent) 22%, transparent)"
                : "var(--surface-main)",
              color: "var(--text-primary)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
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

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-[var(--tenant-accent)]"
      style={{
        borderColor: "var(--surface-border)",
        color: "var(--text-primary)",
        backgroundColor: "var(--surface-main)",
      }}
    />
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm"
      style={{
        borderColor: "rgb(252 165 165)",
        backgroundColor: "rgb(254 242 242)",
        color: "rgb(153 27 27)",
      }}
    >
      {children}
    </div>
  );
}

export function SuccessPanel({
  message,
  onAnother,
}: {
  message: string;
  onAnother: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-[var(--radius-nxt-lg)] border p-8 text-center"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
        boxShadow: "var(--shadow-app)",
      }}
    >
      <CheckCircle2 className="h-10 w-10" style={{ color: "var(--tenant-accent)" }} />
      <p className="max-w-md text-sm" style={{ color: "var(--text-primary)" }}>
        {message}
      </p>
      <button
        type="button"
        onClick={onAnother}
        className="mt-2 text-xs font-medium underline"
        style={{ color: "var(--text-secondary)" }}
      >
        Nog een aanmelding versturen
      </button>
    </div>
  );
}
