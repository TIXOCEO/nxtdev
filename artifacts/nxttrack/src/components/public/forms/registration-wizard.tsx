"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, UserPlus, KeyRound } from "lucide-react";
import {
  publicOnboardingSchema,
  type PublicAccountType,
  type PublicOnboardingInput,
} from "@/lib/validation/public-registration";
import {
  lookupKoppelCode,
  submitPublicRegistration,
} from "@/lib/actions/public/registrations";
import {
  Wizard,
  WizardNav,
  WizardProgress,
  WizardStep,
  type WizardStepDef,
} from "@/components/wizard/wizard";
import { DateSelectField } from "./date-select-field";
import { PlayerTypeSelect } from "./player-type-select";
import { TermsCheckbox } from "./terms-checkbox";
import { Field, Input, ErrorBanner, SuccessPanel } from "./tryout-form";

const FALLBACK_ACCENT = "#b6d83b";

type ChildEntry = {
  mode: "new" | "link";
  first_name: string;
  last_name: string;
  birth_date: string;
  player_type: "" | "player" | "goalkeeper";
  koppel_code: string;
};

type FormValues = {
  tenant_slug: string;
  account_type: PublicAccountType;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date: string;
  player_type: "" | "player" | "goalkeeper";
  children: ChildEntry[];
  extra_details: string;
  agreed_terms: boolean;
};

const EMPTY_CHILD: ChildEntry = {
  mode: "new",
  first_name: "",
  last_name: "",
  birth_date: "",
  player_type: "",
  koppel_code: "",
};

const DEFAULTS = (slug: string): FormValues => ({
  tenant_slug: slug,
  account_type: "parent",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  birth_date: "",
  player_type: "",
  children: [{ ...EMPTY_CHILD }],
  extra_details: "",
  agreed_terms: false,
});

export interface RegistrationWizardProgramRef {
  id: string;
  name: string;
  marketingTitle?: string | null;
  ctaLabel?: string | null;
}

export interface RegistrationWizardProps {
  tenantSlug: string;
  tenantName: string;
  accentColor?: string | null;
  allowStaffRegistration: boolean;
  /** Sprint 63 — Optioneel: programma vooraf gekozen via ?program=<slug>. */
  program?: RegistrationWizardProgramRef | null;
}

export function RegistrationWizard({
  tenantSlug,
  tenantName,
  accentColor,
  allowStaffRegistration,
  program,
}: RegistrationWizardProps) {
  const accent =
    accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor)
      ? accentColor
      : FALLBACK_ACCENT;

  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(publicOnboardingSchema) as unknown as Resolver<FormValues>,
    defaultValues: DEFAULTS(tenantSlug),
    mode: "onTouched",
  });

  const accountType = form.watch("account_type");

  const steps: WizardStepDef[] = useMemo(() => {
    const base: WizardStepDef[] = [
      { id: "type", label: "Type" },
      { id: "person", label: "Gegevens" },
    ];
    if (accountType === "parent") base.push({ id: "kids", label: "Kinderen" });
    base.push({ id: "review", label: "Bevestigen" });
    return base;
  }, [accountType]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "children",
  });

  const handlePrev = () => {
    setServerError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const handleNext = async () => {
    setServerError(null);
    const stepId = steps[step]?.id;
    let valid = true;
    if (stepId === "type") {
      valid = await form.trigger("account_type");
    } else if (stepId === "person") {
      const fields: (keyof FormValues)[] = [
        "first_name",
        "last_name",
        "email",
        "phone",
      ];
      if (accountType === "adult_athlete") {
        fields.push("birth_date", "player_type");
      }
      valid = await form.trigger(fields as never);
    } else if (stepId === "kids") {
      valid = await form.trigger("children" as never);
    }
    if (!valid) {
      setServerError("Controleer de gemarkeerde velden.");
      return;
    }
    setStep((s) => Math.min(steps.length - 1, s + 1));
  };

  const handleSubmit = form.handleSubmit(
    (values) => {
      setServerError(null);
      startTransition(async () => {
        const payload: PublicOnboardingInput = {
          tenant_slug: tenantSlug,
          account_type: values.account_type,
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          phone: values.phone,
          birth_date:
            values.account_type === "adult_athlete" ? values.birth_date : "",
          player_type:
            values.account_type === "adult_athlete"
              ? (values.player_type as "player" | "goalkeeper")
              : undefined,
          children:
            values.account_type === "parent"
              ? values.children.map((c) => ({
                  mode: c.mode,
                  first_name: c.first_name,
                  last_name: c.last_name,
                  birth_date: c.birth_date,
                  player_type: (c.player_type || undefined) as
                    | "player"
                    | "goalkeeper"
                    | undefined,
                  koppel_code: c.koppel_code,
                }))
              : [],
          extra_details: values.extra_details || null,
          agreed_terms: true as const,
          program_id: program?.id ?? null,
        };
        const res = await submitPublicRegistration(payload);
        if (!res.ok) {
          setServerError(res.error);
          return;
        }
        setSuccess(true);
        form.reset(DEFAULTS(tenantSlug));
        setStep(0);
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
        message={`Bedankt! Je aanmelding bij ${tenantName} is ontvangen. Je krijgt een e-mail om je account te activeren.`}
        onAnother={() => setSuccess(false)}
      />
    );
  }

  const errors = form.formState.errors;
  const stepId = steps[step]?.id;

  return (
    <Wizard>
      {program && (
        <div
          className="mb-3 rounded-[var(--radius-nxt-lg)] border px-4 py-3 text-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--tenant-accent) 35%, var(--surface-border))",
            backgroundColor: "color-mix(in srgb, var(--tenant-accent) 8%, transparent)",
            color: "var(--text-primary)",
          }}
          data-testid="registration-program-banner"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            Gekozen programma
          </p>
          <p className="mt-0.5 font-semibold">{program.marketingTitle || program.name}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Je inschrijving wordt automatisch gekoppeld aan dit programma.
          </p>
        </div>
      )}

      <WizardProgress steps={steps} current={step} accentColor={accent} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="space-y-2"
      >
        {stepId === "type" && (
          <WizardStep
            title="Wat voor aanmelding wil je doen?"
            description="Kies hieronder of je je inschrijft als ouder, sporter of vrijwilliger."
          >
            <Controller
              control={form.control}
              name="account_type"
              render={({ field }) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TypeCard
                    selected={field.value === "parent"}
                    onSelect={() => field.onChange("parent")}
                    accent={accent}
                    title="Ouder/verzorger"
                    description="Ik schrijf één of meer kinderen in en beheer hun account."
                  />
                  <TypeCard
                    selected={field.value === "adult_athlete"}
                    onSelect={() => field.onChange("adult_athlete")}
                    accent={accent}
                    title="Sporter (18+)"
                    description="Ik ben volwassen en schrijf mezelf in als nieuw lid."
                  />
                  {allowStaffRegistration && (
                    <>
                      <TypeCard
                        selected={field.value === "trainer"}
                        onSelect={() => field.onChange("trainer")}
                        accent={accent}
                        title="Trainer"
                        description="Ik wil bij deze vereniging trainingen geven."
                      />
                      <TypeCard
                        selected={field.value === "staff"}
                        onSelect={() => field.onChange("staff")}
                        accent={accent}
                        title="Staf / vrijwilliger"
                        description="Ik wil meehelpen in de organisatie."
                      />
                    </>
                  )}
                </div>
              )}
            />
            {errors.account_type?.message && (
              <p className="mt-2 text-[11px] text-red-600">
                {errors.account_type.message}
              </p>
            )}
          </WizardStep>
        )}

        {stepId === "person" && (
          <WizardStep
            title="Persoonlijke gegevens"
            description={
              accountType === "parent"
                ? "Vul hieronder je gegevens in als ouder/verzorger."
                : "Vul hieronder je gegevens in."
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Voornaam" error={errors.first_name?.message}>
                <Input
                  {...form.register("first_name")}
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Achternaam" error={errors.last_name?.message}>
                <Input
                  {...form.register("last_name")}
                  autoComplete="family-name"
                />
              </Field>
              <Field label="E-mail" error={errors.email?.message}>
                <Input
                  type="email"
                  {...form.register("email")}
                  autoComplete="email"
                />
              </Field>
              <Field label="Telefoon" error={errors.phone?.message}>
                <Input
                  type="tel"
                  {...form.register("phone")}
                  autoComplete="tel"
                />
              </Field>
              {accountType === "adult_athlete" && (
                <>
                  <Field
                    label="Geboortedatum"
                    error={errors.birth_date?.message}
                  >
                    <Controller
                      control={form.control}
                      name="birth_date"
                      render={({ field }) => (
                        <DateSelectField
                          value={field.value}
                          onChange={field.onChange}
                          disabled={pending}
                        />
                      )}
                    />
                  </Field>
                  <Field
                    label="Type speler"
                    error={errors.player_type?.message}
                  >
                    <Controller
                      control={form.control}
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
          </WizardStep>
        )}

        {stepId === "kids" && (
          <WizardStep
            title="Kinderen toevoegen"
            description="Voeg per kind de gegevens in, of koppel een bestaand kind via een koppelcode."
          >
            {fields.map((f, idx) => {
              const mode = form.watch(`children.${idx}.mode` as const);
              const childErrs = errors.children?.[idx];
              return (
                <div
                  key={f.id}
                  className="space-y-4 rounded-[var(--radius-nxt-lg)] border p-4"
                  style={{
                    borderColor: "var(--surface-border)",
                    backgroundColor: "var(--surface-soft)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p
                      className="text-xs font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Kind {idx + 1}
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

                  <Controller
                    control={form.control}
                    name={`children.${idx}.mode` as const}
                    render={({ field }) => (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <ModeChip
                          icon={<UserPlus className="h-4 w-4" />}
                          label="Nieuw kind"
                          selected={field.value === "new"}
                          onSelect={() => field.onChange("new")}
                          accent={accent}
                        />
                        <ModeChip
                          icon={<KeyRound className="h-4 w-4" />}
                          label="Koppel via koppelcode"
                          selected={field.value === "link"}
                          onSelect={() => field.onChange("link")}
                          accent={accent}
                        />
                      </div>
                    )}
                  />

                  {mode === "new" ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field
                        label="Voornaam"
                        error={childErrs?.first_name?.message}
                      >
                        <Input
                          {...form.register(
                            `children.${idx}.first_name` as const,
                          )}
                        />
                      </Field>
                      <Field
                        label="Achternaam"
                        error={childErrs?.last_name?.message}
                      >
                        <Input
                          {...form.register(
                            `children.${idx}.last_name` as const,
                          )}
                        />
                      </Field>
                      <Field
                        label="Geboortedatum"
                        error={childErrs?.birth_date?.message}
                      >
                        <Controller
                          control={form.control}
                          name={`children.${idx}.birth_date` as const}
                          render={({ field }) => (
                            <DateSelectField
                              value={field.value}
                              onChange={field.onChange}
                              disabled={pending}
                            />
                          )}
                        />
                      </Field>
                      <Field
                        label="Type speler"
                        error={childErrs?.player_type?.message}
                      >
                        <Controller
                          control={form.control}
                          name={`children.${idx}.player_type` as const}
                          render={({ field }) => (
                            <PlayerTypeSelect
                              value={field.value ?? ""}
                              onChange={(v) => field.onChange(v)}
                              disabled={pending}
                            />
                          )}
                        />
                      </Field>
                    </div>
                  ) : (
                    <Controller
                      control={form.control}
                      name={`children.${idx}.koppel_code` as const}
                      render={({ field }) => (
                        <KoppelCodeField
                          value={field.value}
                          onChange={field.onChange}
                          tenantSlug={tenantSlug}
                          fieldError={childErrs?.koppel_code?.message}
                        />
                      )}
                    />
                  )}
                </div>
              );
            })}

            {errors.children?.message && (
              <p className="text-[11px] text-red-600">
                {errors.children.message as string}
              </p>
            )}

            <button
              type="button"
              onClick={() => append({ ...EMPTY_CHILD })}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            >
              <Plus className="h-4 w-4" /> Nog een kind toevoegen
            </button>
          </WizardStep>
        )}

        {stepId === "review" && (
          <WizardStep
            title="Bevestigen"
            description="Controleer de gegevens hieronder en bevestig je aanmelding."
          >
            <ReviewSummary values={form.getValues()} />

            <Field label="Extra details" hint="Optioneel · max 1500 tekens">
              <textarea
                {...form.register("extra_details")}
                rows={3}
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
              control={form.control}
              name="agreed_terms"
              render={({ field }) => (
                <div>
                  <TermsCheckbox
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={pending}
                  />
                  {errors.agreed_terms?.message && (
                    <p className="mt-1 text-[11px] text-red-600">
                      {errors.agreed_terms.message}
                    </p>
                  )}
                </div>
              )}
            />
          </WizardStep>
        )}

        {serverError && (
          <div className="mt-4">
            <ErrorBanner>{serverError}</ErrorBanner>
          </div>
        )}

        <WizardNav
          current={step}
          total={steps.length}
          pending={pending}
          onPrev={handlePrev}
          onNext={handleNext}
          onSubmit={handleSubmit}
          accentColor={accent}
          submitLabel="Aanmelding versturen"
        />
      </form>
    </Wizard>
  );
}

// ──────────────────────────────────────────────────────────────────
// Local helpers
// ──────────────────────────────────────────────────────────────────

function TypeCard({
  selected,
  onSelect,
  accent,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  accent: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex flex-col items-start gap-1 rounded-[var(--radius-nxt-lg)] border p-4 text-left transition-colors"
      style={{
        borderColor: selected ? accent : "var(--surface-border)",
        backgroundColor: selected
          ? `color-mix(in srgb, ${accent} 14%, transparent)`
          : "var(--surface-main)",
      }}
    >
      <span
        className="text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </span>
      <span
        className="text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        {description}
      </span>
    </button>
  );
}

type KoppelLookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; child_first_name: string }
  | { status: "error"; message: string };

function KoppelCodeField({
  value,
  onChange,
  tenantSlug,
  fieldError,
}: {
  value: string;
  onChange: (v: string) => void;
  tenantSlug: string;
  fieldError?: string;
}) {
  const [state, setState] = useState<KoppelLookupState>({ status: "idle" });
  const reqIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const trimmed = (value ?? "").trim();
    if (trimmed.length < 4) {
      setState({ status: "idle" });
      return;
    }
    timerRef.current = setTimeout(async () => {
      const myId = ++reqIdRef.current;
      setState({ status: "loading" });
      try {
        const res = await lookupKoppelCode(tenantSlug, trimmed);
        if (myId !== reqIdRef.current) return;
        if (res.ok) {
          setState({ status: "ok", child_first_name: res.child_first_name });
        } else {
          setState({ status: "error", message: res.error });
        }
      } catch {
        if (myId !== reqIdRef.current) return;
        setState({
          status: "error",
          message: "Kon de koppelcode nu niet controleren.",
        });
      }
    }, 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, tenantSlug]);

  const inlineMessage =
    state.status === "loading"
      ? "Controleren…"
      : state.status === "ok"
        ? `Gekoppeld aan ${state.child_first_name || "kind"}.`
        : state.status === "error"
          ? state.message
          : undefined;
  const inlineColor =
    state.status === "ok"
      ? "text-emerald-700"
      : state.status === "error"
        ? "text-red-600"
        : "text-[var(--text-secondary)]";

  return (
    <Field
      label="Koppelcode"
      hint="Je hebt deze code per e-mail ontvangen."
      error={fieldError}
    >
      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onBlur={(e) => onChange(e.target.value.trim().toUpperCase())}
        autoCapitalize="characters"
        placeholder="K7P-9F4M"
        aria-invalid={state.status === "error" || !!fieldError}
      />
      {!fieldError && inlineMessage && (
        <p className={`mt-1 text-[11px] ${inlineColor}`}>{inlineMessage}</p>
      )}
    </Field>
  );
}

function ModeChip({
  icon,
  label,
  selected,
  onSelect,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onSelect: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors"
      style={{
        borderColor: selected ? accent : "var(--surface-border)",
        backgroundColor: selected
          ? `color-mix(in srgb, ${accent} 14%, transparent)`
          : "var(--surface-main)",
        color: "var(--text-primary)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

const ACCOUNT_TYPE_LABELS: Record<PublicAccountType, string> = {
  parent: "Ouder/verzorger",
  adult_athlete: "Sporter (18+)",
  trainer: "Trainer",
  staff: "Staf / vrijwilliger",
};

function ReviewSummary({ values }: { values: FormValues }) {
  return (
    <dl
      className="grid grid-cols-1 gap-y-2 rounded-[var(--radius-nxt-lg)] border p-4 text-sm sm:grid-cols-3 sm:gap-x-4"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-soft)",
      }}
    >
      <Row label="Type" value={ACCOUNT_TYPE_LABELS[values.account_type]} />
      <Row
        label="Naam"
        value={`${values.first_name} ${values.last_name}`.trim()}
      />
      <Row label="E-mail" value={values.email} />
      <Row label="Telefoon" value={values.phone} />
      {values.account_type === "adult_athlete" && (
        <>
          <Row label="Geboortedatum" value={values.birth_date} />
          <Row
            label="Type speler"
            value={
              values.player_type === "goalkeeper"
                ? "Keeper"
                : values.player_type === "player"
                  ? "Veldspeler"
                  : "—"
            }
          />
        </>
      )}
      {values.account_type === "parent" && values.children.length > 0 && (
        <div className="sm:col-span-3">
          <dt
            className="text-xs uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Kinderen
          </dt>
          <ul className="mt-1 space-y-1">
            {values.children.map((c, i) => (
              <li
                key={i}
                className="text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                {c.mode === "new"
                  ? `${c.first_name} ${c.last_name}`.trim() +
                    (c.birth_date ? ` · ${c.birth_date}` : "")
                  : `Koppelcode: ${c.koppel_code}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        className="text-xs uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </dt>
      <dd
        className="mt-0.5 text-sm"
        style={{ color: "var(--text-primary)" }}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
