"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserRound, GraduationCap, Baby, Megaphone, Briefcase, Mail, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Wizard,
  WizardProgress,
  WizardStep,
  WizardNav,
  type WizardStepDef,
} from "@/components/wizard/wizard";
import { createMemberWithInvite } from "@/lib/actions/tenant/invites";
import type { InviteTypeLiteral } from "@/lib/actions/tenant/invite-statuses";

type AccountType = "parent" | "adult_athlete" | "minor_athlete" | "trainer" | "staff";
type AdultMethod = "invite" | "manual";
type MinorMethod = "existing_parent" | "invite_parent";

interface AccountTypeOption {
  value: AccountType;
  label: string;
  description: string;
  Icon: typeof UserRound;
}

const ACCOUNT_TYPES: AccountTypeOption[] = [
  {
    value: "parent",
    label: "Ouder",
    description: "Volwassene die kinderen beheert.",
    Icon: UserRound,
  },
  {
    value: "adult_athlete",
    label: "Sporter (volwassen)",
    description: "Speler vanaf 18 jaar met eigen account.",
    Icon: GraduationCap,
  },
  {
    value: "minor_athlete",
    label: "Sporter (minderjarig)",
    description: "Kind dat aan een ouder gekoppeld wordt.",
    Icon: Baby,
  },
  {
    value: "trainer",
    label: "Trainer",
    description: "Trainer met admin-toegang.",
    Icon: Megaphone,
  },
  {
    value: "staff",
    label: "Staf",
    description: "Bestuur of vrijwilliger met admin-toegang.",
    Icon: Briefcase,
  },
];

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = ACCOUNT_TYPES.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<AccountType, string>,
);

function inviteTypeFor(t: AccountType): InviteTypeLiteral {
  switch (t) {
    case "parent":
      return "parent_account";
    case "adult_athlete":
      return "adult_athlete_account";
    case "trainer":
      return "trainer_account";
    case "staff":
      return "staff_account";
    case "minor_athlete":
      return "minor_parent_link";
  }
}

function rolesFor(t: AccountType): Array<"parent" | "athlete" | "trainer" | "staff"> {
  switch (t) {
    case "parent":
      return ["parent"];
    case "adult_athlete":
      return ["athlete"];
    case "minor_athlete":
      return ["athlete"];
    case "trainer":
      return ["trainer"];
    case "staff":
      return ["staff"];
  }
}

interface FormState {
  account_type: AccountType | null;
  adult_method: AdultMethod;
  minor_method: MinorMethod;
  full_name: string;
  email: string;
  phone: string;
  parent_member_id: string;
  parent_email: string;
  confirm_duplicate: boolean;
}

function initialState(): FormState {
  return {
    account_type: null,
    adult_method: "invite",
    minor_method: "existing_parent",
    full_name: "",
    email: "",
    phone: "",
    parent_member_id: "",
    parent_email: "",
    confirm_duplicate: false,
  };
}

const inputCls =
  "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";
const inputStyle = {
  borderColor: "var(--surface-border)",
  color: "var(--text-primary)",
  backgroundColor: "var(--surface-main)",
} as const;

export interface AddMemberWizardProps {
  tenantId: string;
  existingParents: Array<{ id: string; full_name: string }>;
}

export function AddMemberWizard({ tenantId, existingParents }: AddMemberWizardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FormState>(initialState);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const accentColor = "var(--accent)";
  const isMinor = state.account_type === "minor_athlete";

  const steps: WizardStepDef[] = useMemo(
    () => [
      { id: "type", label: "Type" },
      { id: "method", label: isMinor ? "Ouder" : "Methode" },
      { id: "details", label: "Gegevens" },
      { id: "confirm", label: "Bevestig" },
    ],
    [isMinor],
  );

  function reset(): void {
    setState(initialState());
    setStep(0);
    setServerError(null);
    setStepError(null);
  }

  function update<K extends keyof FormState>(k: K, v: FormState[K]): void {
    setState((s) => ({ ...s, [k]: v }));
    setStepError(null);
  }

  function validateStep(idx: number): string | null {
    if (idx === 0) {
      if (!state.account_type) return "Kies een account-type.";
      return null;
    }
    if (idx === 1) {
      if (isMinor) {
        if (state.minor_method === "existing_parent" && !state.parent_member_id) {
          return existingParents.length === 0
            ? "Er zijn nog geen ouders. Kies 'Nieuwe ouder uitnodigen'."
            : "Kies een bestaande ouder.";
        }
        if (state.minor_method === "invite_parent") {
          const v = state.parent_email.trim();
          if (!v) return "Vul het e-mailadres van de ouder in.";
          if (!/.+@.+\..+/.test(v)) return "Ongeldig e-mailadres.";
        }
      }
      return null;
    }
    if (idx === 2) {
      if (!state.full_name.trim() || state.full_name.trim().length < 2) {
        return isMinor ? "Naam van het kind is verplicht." : "Naam is verplicht.";
      }
      if (!isMinor && state.adult_method === "invite") {
        const v = state.email.trim();
        if (!v) return "E-mail is verplicht voor uitnodigingen.";
        if (!/.+@.+\..+/.test(v)) return "Ongeldig e-mailadres.";
      }
      return null;
    }
    return null;
  }

  function onPrev(): void {
    setStepError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function onNext(): void {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  function onSubmit(): void {
    const err =
      validateStep(0) ?? validateStep(1) ?? validateStep(2);
    if (err) {
      setStepError(err);
      return;
    }
    if (!state.account_type) return;

    setServerError(null);
    const t = state.account_type;
    const roles = rolesFor(t);

    startTransition(async () => {
      let mode: "manual" | "invite" | "minor";
      let inviteType: InviteTypeLiteral | undefined;
      let parentMemberId = "";
      let parentEmail = "";
      let email = "";

      if (t === "minor_athlete") {
        mode = "minor";
        if (state.minor_method === "existing_parent") {
          parentMemberId = state.parent_member_id;
        } else {
          parentEmail = state.parent_email.trim();
        }
      } else if (state.adult_method === "invite") {
        mode = "invite";
        inviteType = inviteTypeFor(t);
        email = state.email.trim();
      } else {
        mode = "manual";
        email = state.email.trim();
      }

      const res = await createMemberWithInvite({
        tenant_id: tenantId,
        mode,
        invite_type: inviteType,
        full_name: state.full_name.trim(),
        email: email || "",
        phone: state.phone.trim() || "",
        roles,
        parent_member_id: parentMemberId || "",
        parent_email: parentEmail || "",
        confirm_duplicate: state.confirm_duplicate,
      });

      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-4 w-4" /> Voeg toe
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Nieuw lid toevoegen</DialogTitle>
          <DialogDescription>
            Doorloop de stappen om een lid aan te maken en eventueel uit te nodigen.
          </DialogDescription>
        </DialogHeader>

        <Wizard className="mt-2">
          <WizardProgress steps={steps} current={step} accentColor={accentColor} />

          {step === 0 && (
            <WizardStep
              title="Wat voor lid voeg je toe?"
              description="Het type bepaalt welke vervolgstappen je doorloopt."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {ACCOUNT_TYPES.map((opt) => {
                  const active = state.account_type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update("account_type", opt.value)}
                      className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors"
                      style={{
                        borderColor: active ? accentColor : "var(--surface-border)",
                        backgroundColor: active
                          ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                          : "var(--surface-main)",
                      }}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: "var(--surface-soft)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <opt.Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span
                          className="block text-sm font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {opt.label}
                        </span>
                        <span
                          className="mt-0.5 block text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {opt.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </WizardStep>
          )}

          {step === 1 && (
            <WizardStep
              title={isMinor ? "Hoe koppel je een ouder?" : "Hoe wil je dit lid aanmaken?"}
              description={
                isMinor
                  ? "Een minderjarige sporter heeft altijd een ouder/voogd nodig."
                  : "Een uitnodiging stuurt direct een mail. Handmatig maakt alleen het profiel aan."
              }
            >
              {isMinor ? (
                <div className="space-y-3">
                  <MethodOption
                    selected={state.minor_method === "existing_parent"}
                    onSelect={() => update("minor_method", "existing_parent")}
                    Icon={UserCheck}
                    title="Bestaande ouder kiezen"
                    description="Koppel direct aan een ouder die al in de club zit."
                    disabled={existingParents.length === 0}
                    disabledNote={
                      existingParents.length === 0
                        ? "Geen ouders beschikbaar — voeg eerst een ouder toe."
                        : undefined
                    }
                  />
                  {state.minor_method === "existing_parent" &&
                    existingParents.length > 0 && (
                      <div className="pl-2">
                        <label
                          className="mb-1 block text-xs font-medium"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Ouder *
                        </label>
                        <select
                          className={inputCls}
                          style={inputStyle}
                          value={state.parent_member_id}
                          onChange={(e) => update("parent_member_id", e.target.value)}
                        >
                          <option value="">— Kies een ouder —</option>
                          {existingParents.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                  <MethodOption
                    selected={state.minor_method === "invite_parent"}
                    onSelect={() => update("minor_method", "invite_parent")}
                    Icon={Mail}
                    title="Nieuwe ouder uitnodigen via e-mail"
                    description="De ouder ontvangt een mail om een account aan te maken en het kind te koppelen."
                  />
                  {state.minor_method === "invite_parent" && (
                    <div className="pl-2">
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        E-mail ouder *
                      </label>
                      <input
                        type="email"
                        className={inputCls}
                        style={inputStyle}
                        placeholder="ouder@voorbeeld.nl"
                        value={state.parent_email}
                        onChange={(e) => update("parent_email", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <MethodOption
                    selected={state.adult_method === "invite"}
                    onSelect={() => update("adult_method", "invite")}
                    Icon={Mail}
                    title="Direct uitnodigen via e-mail"
                    description="Het lid ontvangt meteen een mail om een account aan te maken."
                  />
                  <MethodOption
                    selected={state.adult_method === "manual"}
                    onSelect={() => update("adult_method", "manual")}
                    Icon={UserCheck}
                    title="Alleen aanmaken (geen mail)"
                    description="Maak het profiel aan; je kunt later alsnog een uitnodiging sturen."
                  />
                </div>
              )}
            </WizardStep>
          )}

          {step === 2 && (
            <WizardStep
              title="Vul de gegevens in"
              description={
                isMinor
                  ? "Naam van het kind. Het kind krijgt zelf geen e-mail."
                  : "Basisgegevens van het lid."
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    className="mb-1 block text-xs font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Volledige naam *
                  </label>
                  <input
                    className={inputCls}
                    style={inputStyle}
                    placeholder={isMinor ? "Naam van het kind" : "Voor- en achternaam"}
                    value={state.full_name}
                    onChange={(e) => update("full_name", e.target.value)}
                  />
                </div>

                {!isMinor && (
                  <>
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        E-mail{state.adult_method === "invite" ? " *" : ""}
                      </label>
                      <input
                        type="email"
                        className={inputCls}
                        style={inputStyle}
                        value={state.email}
                        onChange={(e) => update("email", e.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Telefoon
                      </label>
                      <input
                        className={inputCls}
                        style={inputStyle}
                        value={state.phone}
                        onChange={(e) => update("phone", e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            </WizardStep>
          )}

          {step === 3 && state.account_type && (
            <WizardStep
              title="Controleer en bevestig"
              description="Controleer de gegevens voor je het lid aanmaakt."
            >
              <dl
                className="divide-y rounded-xl border text-sm"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <ReviewRow label="Type" value={ACCOUNT_TYPE_LABEL[state.account_type]} />
                <ReviewRow
                  label="Methode"
                  value={
                    isMinor
                      ? state.minor_method === "existing_parent"
                        ? `Koppel aan ${
                            existingParents.find((p) => p.id === state.parent_member_id)
                              ?.full_name ?? "ouder"
                          }`
                        : `Uitnodiging naar ${state.parent_email}`
                      : state.adult_method === "invite"
                        ? `Uitnodigen via ${state.email}`
                        : "Alleen aanmaken (geen mail)"
                  }
                />
                <ReviewRow label="Naam" value={state.full_name} />
                {!isMinor && state.email && (
                  <ReviewRow label="E-mail" value={state.email} />
                )}
                {!isMinor && state.phone && (
                  <ReviewRow label="Telefoon" value={state.phone} />
                )}
              </dl>

              {serverError && (
                <div className="space-y-2">
                  <p className="text-sm text-red-600" role="alert">
                    {serverError}
                  </p>
                  {/dubbele/i.test(serverError) && (
                    <label
                      className="inline-flex items-center gap-2 text-xs"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <input
                        type="checkbox"
                        checked={state.confirm_duplicate}
                        onChange={(e) =>
                          update("confirm_duplicate", e.target.checked)
                        }
                      />
                      Toch aanmaken (negeer dubbele check)
                    </label>
                  )}
                </div>
              )}
            </WizardStep>
          )}

          {stepError && (
            <p className="mt-3 text-xs text-red-600" role="alert">
              {stepError}
            </p>
          )}

          <WizardNav
            current={step}
            total={steps.length}
            pending={pending}
            onPrev={onPrev}
            onNext={onNext}
            onSubmit={onSubmit}
            accentColor={accentColor}
            submitLabel="Lid aanmaken"
          />
        </Wizard>
      </DialogContent>
    </Dialog>
  );
}

interface MethodOptionProps {
  selected: boolean;
  onSelect: () => void;
  Icon: typeof Mail;
  title: string;
  description: string;
  disabled?: boolean;
  disabledNote?: string;
}

function MethodOption({
  selected,
  onSelect,
  Icon,
  title,
  description,
  disabled,
  disabledNote,
}: MethodOptionProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50"
      style={{
        borderColor: selected ? "var(--accent)" : "var(--surface-border)",
        backgroundColor: selected
          ? "color-mix(in srgb, var(--accent) 8%, transparent)"
          : "var(--surface-main)",
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: "var(--surface-soft)",
          color: "var(--text-primary)",
        }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </span>
        <span
          className="mt-0.5 block text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </span>
        {disabledNote && (
          <span
            className="mt-1 block text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {disabledNote}
          </span>
        )}
      </span>
    </button>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-2.5">
      <dt
        className="col-span-1 text-xs font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </dt>
      <dd
        className="col-span-2 text-sm"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </dd>
    </div>
  );
}
