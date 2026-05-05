"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  UserRound,
  GraduationCap,
  Baby,
  Megaphone,
  Briefcase,
  Mail,
  UserCheck,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Wizard,
  WizardProgress,
  WizardStep,
  WizardNav,
  type WizardStepDef,
} from "@/components/wizard/wizard";
import { createMemberWithInvite } from "@/lib/actions/tenant/invites";
import type { InviteTypeLiteral } from "@/lib/actions/tenant/invite-statuses";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { MEMBER_STATUSES } from "@/lib/validation/members";

type AccountType = "parent" | "adult_athlete" | "minor_athlete" | "trainer" | "staff";
type AdultMethod = "invite" | "manual";
type MinorMethod = "existing_parent" | "invite_parent" | "new_parent";

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

const STATUS_LABEL: Record<string, string> = {
  prospect: "Prospect",
  aspirant: "Aspirant-lid",
  pending: "Wachtend",
  active: "Actief",
  paused: "Gepauzeerd",
  cancelled: "Opgezegd",
  inactive: "Inactief",
  archived: "Gearchiveerd",
};

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

function defaultStatusFor(t: AccountType): string {
  if (t === "trainer" || t === "staff") return "pending";
  return "aspirant";
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
  // Sprint D: nieuwe ouder direct aanmaken (zonder uitnodiging).
  new_parent_full_name: string;
  new_parent_email: string;
  new_parent_phone: string;
  // Sprint D: admin-stap.
  member_status: string;
  membership_plan_id: string;
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
    new_parent_full_name: "",
    new_parent_email: "",
    new_parent_phone: "",
    member_status: "aspirant",
    membership_plan_id: "",
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
  membershipPlans: Array<{ id: string; name: string }>;
}

export function AddMemberWizard({
  tenantId,
  existingParents,
  membershipPlans,
}: AddMemberWizardProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FormState>(initialState);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const accentColor = "var(--accent)";
  const isMinor = state.account_type === "minor_athlete";
  const hasPlans = membershipPlans.length > 0;

  const steps: WizardStepDef[] = useMemo(
    () => [
      { id: "type", label: "Type" },
      { id: "method", label: isMinor ? "Ouder" : "Methode" },
      { id: "details", label: "Gegevens" },
      { id: "admin", label: "Admin" },
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
    setState((s) => {
      const next = { ...s, [k]: v };
      // Wanneer account-type verandert, reset status-default zodat de
      // admin-stap een passende default toont (athlete/parent → aspirant,
      // trainer/staff → pending).
      if (k === "account_type" && v) {
        next.member_status = defaultStatusFor(v as AccountType);
      }
      return next;
    });
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
            ? "Er zijn nog geen ouders. Kies een andere optie."
            : "Kies een bestaande ouder.";
        }
        if (state.minor_method === "invite_parent") {
          const v = state.parent_email.trim();
          if (!v) return "Vul het e-mailadres van de ouder in.";
          if (!/.+@.+\..+/.test(v)) return "Ongeldig e-mailadres.";
        }
        if (state.minor_method === "new_parent") {
          const n = state.new_parent_full_name.trim();
          if (n.length < 2) return "Vul de naam van de ouder in.";
          const e = state.new_parent_email.trim();
          if (e && !/.+@.+\..+/.test(e)) return "Ongeldig e-mailadres ouder.";
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
    if (idx === 3) {
      if (!state.member_status) return "Kies een status.";
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
      validateStep(0) ?? validateStep(1) ?? validateStep(2) ?? validateStep(3);
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
      let newParentFullName = "";
      let newParentEmail = "";
      let newParentPhone = "";

      if (t === "minor_athlete") {
        mode = "minor";
        if (state.minor_method === "existing_parent") {
          parentMemberId = state.parent_member_id;
        } else if (state.minor_method === "invite_parent") {
          parentEmail = state.parent_email.trim();
        } else {
          newParentFullName = state.new_parent_full_name.trim();
          newParentEmail = state.new_parent_email.trim();
          newParentPhone = state.new_parent_phone.trim();
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
        member_status: state.member_status as (typeof MEMBER_STATUSES)[number],
        assign_membership_plan_id: state.membership_plan_id || "",
        new_parent_full_name: newParentFullName || "",
        new_parent_email: newParentEmail || "",
        new_parent_phone: newParentPhone || "",
      });

      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      toast({
        title: "Lid aangemaakt",
        description:
          mode === "invite" || (mode === "minor" && parentEmail)
            ? "Het lid is aangemaakt en de uitnodiging is verstuurd."
            : "Het lid is aangemaakt.",
      });
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  const triggerButton = (
    <button
      type="button"
      className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50"
      style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
    >
      <Plus className="h-4 w-4" /> Voeg toe
    </button>
  );

  const body = (
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
                    ? "Geen ouders beschikbaar — kies een andere optie."
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

              <MethodOption
                selected={state.minor_method === "new_parent"}
                onSelect={() => update("minor_method", "new_parent")}
                Icon={UserPlus}
                title="Nieuwe ouder direct aanmaken"
                description="Maak meteen een ouder-profiel aan zonder uitnodiging te versturen."
              />
              {state.minor_method === "new_parent" && (
                <div className="grid gap-2 pl-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      className="mb-1 block text-xs font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Naam ouder *
                    </label>
                    <input
                      className={inputCls}
                      style={inputStyle}
                      value={state.new_parent_full_name}
                      onChange={(e) =>
                        update("new_parent_full_name", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-xs font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      E-mail ouder
                    </label>
                    <input
                      type="email"
                      className={inputCls}
                      style={inputStyle}
                      value={state.new_parent_email}
                      onChange={(e) =>
                        update("new_parent_email", e.target.value)
                      }
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
                      value={state.new_parent_phone}
                      onChange={(e) =>
                        update("new_parent_phone", e.target.value)
                      }
                    />
                  </div>
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

      {step === 3 && (
        <WizardStep
          title="Administratieve gegevens"
          description="Status en (optioneel) een lidmaatschap voor dit lid."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Status *
              </label>
              <select
                className={inputCls}
                style={inputStyle}
                value={state.member_status}
                onChange={(e) => update("member_status", e.target.value)}
              >
                {MEMBER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
              <p
                className="mt-1 text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                Default voor dit type:{" "}
                {STATUS_LABEL[
                  defaultStatusFor(state.account_type ?? "adult_athlete")
                ]}
                .
              </p>
            </div>

            {hasPlans && (
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Lidmaatschap (optioneel)
                </label>
                <select
                  className={inputCls}
                  style={inputStyle}
                  value={state.membership_plan_id}
                  onChange={(e) => update("membership_plan_id", e.target.value)}
                >
                  <option value="">— Geen —</option>
                  {membershipPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </WizardStep>
      )}

      {step === 4 && state.account_type && (
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
                    : state.minor_method === "invite_parent"
                      ? `Uitnodiging naar ${state.parent_email}`
                      : `Nieuwe ouder: ${state.new_parent_full_name}`
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
            <ReviewRow
              label="Status"
              value={STATUS_LABEL[state.member_status] ?? state.member_status}
            />
            {hasPlans && state.membership_plan_id && (
              <ReviewRow
                label="Lidmaatschap"
                value={
                  membershipPlans.find((p) => p.id === state.membership_plan_id)
                    ?.name ?? "—"
                }
              />
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
  );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Nieuw lid toevoegen</DrawerTitle>
            <DrawerDescription>
              Doorloop de stappen om een lid aan te maken.
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Nieuw lid toevoegen</DialogTitle>
          <DialogDescription>
            Doorloop de stappen om een lid aan te maken en eventueel uit te nodigen.
          </DialogDescription>
        </DialogHeader>
        {body}
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

function ReviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-2.5">
      <dt
        className="col-span-1 text-xs font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </dt>
      <dd className="col-span-2 text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </dd>
    </div>
  );
}
