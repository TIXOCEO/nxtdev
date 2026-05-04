"use client";

import { useState, useTransition } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import {
  useForm,
  Controller,
  useFieldArray,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  publicMembershipRegistrationSchema,
  type PublicMembershipRegistrationInput,
} from "@/lib/validation/public-registration";
import { submitMembershipRegistration } from "@/lib/actions/public/registrations";
import { DateSelectField } from "./date-select-field";
import { PlayerTypeSelect } from "./player-type-select";
import { TermsCheckbox } from "./terms-checkbox";
import {
  Field,
  Input,
  ErrorBanner,
  SuccessPanel,
  TargetToggle,
} from "./tryout-form";

export interface MembershipRegistrationFormProps {
  tenantSlug: string;
}

type AthleteEntry = {
  full_name: string;
  date_of_birth: string;
  player_type: "" | "player" | "goalkeeper";
};

type FormValues = {
  tenant_slug: string;
  registration_target: "self" | "child";
  full_name: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  date_of_birth: string;
  player_type: "" | "player" | "goalkeeper";
  extra_details: string;
  agreed_terms: boolean;
  athletes: AthleteEntry[];
};

const EMPTY_ATHLETE: AthleteEntry = {
  full_name: "",
  date_of_birth: "",
  player_type: "",
};

const DEFAULTS = (slug: string): FormValues => ({
  tenant_slug: slug,
  registration_target: "self",
  full_name: "",
  address: "",
  postal_code: "",
  city: "",
  phone: "",
  email: "",
  date_of_birth: "",
  player_type: "",
  extra_details: "",
  agreed_terms: false,
  athletes: [{ ...EMPTY_ATHLETE }],
});

export function MembershipRegistrationForm({
  tenantSlug,
}: MembershipRegistrationFormProps) {
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
    resolver: zodResolver(
      publicMembershipRegistrationSchema,
    ) as unknown as Resolver<FormValues>,
    defaultValues: DEFAULTS(tenantSlug),
  });

  const target = watch("registration_target");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "athletes",
  });

  const onSubmit = handleSubmit(
    (values) => {
      setServerError(null);
      startTransition(async () => {
        const payload = {
          tenant_slug: tenantSlug,
          registration_target: values.registration_target,
          full_name: values.full_name,
          address: values.address,
          postal_code: values.postal_code,
          city: values.city,
          phone: values.phone,
          email: values.email,
          extra_details: values.extra_details || null,
          agreed_terms: true as const,
          date_of_birth:
            values.registration_target === "self" ? values.date_of_birth : "",
          player_type:
            values.registration_target === "self"
              ? (values.player_type as "player" | "goalkeeper")
              : undefined,
          // schema is loose at object level — empty rows are ignored when
          // target=self; strict per-field validation runs only for child.
          athletes:
            values.registration_target === "child"
              ? values.athletes.map((a) => ({
                  full_name: a.full_name,
                  date_of_birth: a.date_of_birth,
                  player_type: a.player_type as "player" | "goalkeeper",
                }))
              : [],
        } satisfies PublicMembershipRegistrationInput;

        const res = await submitMembershipRegistration(payload);
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
        message="Bedankt! De inschrijving is ontvangen. De aanmelding staat nu als aspirant-lid geregistreerd."
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
      <Field label="Wie wordt er ingeschreven?" error={errors.registration_target?.message}>
        <TargetToggle
          value={target}
          onChange={(v) => setValue("registration_target", v, { shouldValidate: false })}
          selfLabel="Ik wil mezelf inschrijven als nieuw lid"
          childLabel="Ik wil mijn kind inschrijven als nieuw lid"
        />
      </Field>

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          {target === "child" ? "Gegevens ouder/verzorger" : "Persoonlijke gegevens"}
        </legend>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label={target === "child" ? "Naam ouder/verzorger" : "Volledige naam"}
            error={errors.full_name?.message}
            className="sm:col-span-2"
          >
            <Input {...register("full_name")} autoComplete="name" />
          </Field>
          <Field label="Adres" error={errors.address?.message} className="sm:col-span-2">
            <Input {...register("address")} autoComplete="street-address" />
          </Field>
          <Field label="Postcode" error={errors.postal_code?.message}>
            <Input {...register("postal_code")} autoComplete="postal-code" placeholder="1234 AB" />
          </Field>
          <Field label="Plaats" error={errors.city?.message}>
            <Input {...register("city")} autoComplete="address-level2" />
          </Field>
          <Field label="Telefoon" error={errors.phone?.message}>
            <Input type="tel" {...register("phone")} autoComplete="tel" />
          </Field>
          <Field label="E-mail" error={errors.email?.message}>
            <Input type="email" {...register("email")} autoComplete="email" />
          </Field>

          {target === "self" && (
            <>
              <Field label="Geboortedatum" error={errors.date_of_birth?.message}>
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
            </>
          )}
        </div>
      </fieldset>

      {target === "child" && (
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            Spelers
          </legend>

          {fields.map((f, idx) => (
            <div
              key={f.id}
              className="space-y-4 rounded-[var(--radius-nxt-lg)] border p-4"
              style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-soft)" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  Speler {idx + 1}
                </p>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Verwijderen
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Naam kind"
                  error={errors.athletes?.[idx]?.full_name?.message}
                  className="sm:col-span-2"
                >
                  <Input {...register(`athletes.${idx}.full_name` as const)} />
                </Field>
                <Field
                  label="Geboortedatum"
                  error={errors.athletes?.[idx]?.date_of_birth?.message}
                >
                  <Controller
                    control={control}
                    name={`athletes.${idx}.date_of_birth` as const}
                    render={({ field }) => (
                      <DateSelectField value={field.value} onChange={field.onChange} disabled={pending} />
                    )}
                  />
                </Field>
                <Field
                  label="Type speler"
                  error={errors.athletes?.[idx]?.player_type?.message}
                >
                  <Controller
                    control={control}
                    name={`athletes.${idx}.player_type` as const}
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
            </div>
          ))}

          {errors.athletes?.message && (
            <p className="text-[11px] text-red-600">{errors.athletes.message}</p>
          )}

          <button
            type="button"
            onClick={() => append({ ...EMPTY_ATHLETE })}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          >
            <Plus className="h-4 w-4" /> Nog een speler toevoegen
          </button>
        </fieldset>
      )}

      <Field label="Extra details" hint="Optioneel · max 1500 tekens" error={errors.extra_details?.message}>
        <textarea
          {...register("extra_details")}
          rows={4}
          maxLength={1500}
          placeholder="Aanvullende informatie."
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
          {pending ? "Versturen…" : "Inschrijving versturen"}
        </button>
      </div>
    </form>
  );
}
