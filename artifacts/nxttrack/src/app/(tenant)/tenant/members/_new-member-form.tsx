"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  newMemberWithInviteSchema,
  type NewMemberWithInviteInput,
} from "@/lib/validation/invites";
import { MEMBER_ROLES } from "@/lib/validation/members";
import {
  INVITE_TYPES,
  INVITE_TYPE_LABELS,
  type InviteTypeLiteral,
} from "@/lib/actions/tenant/invite-statuses";
import { createMemberWithInvite } from "@/lib/actions/tenant/invites";

const ROLE_LABELS: Record<string, string> = {
  parent: "Ouder",
  athlete: "Speler",
  trainer: "Trainer",
  staff: "Staf",
  volunteer: "Vrijwilliger",
};

const MODES = [
  { value: "manual", label: "Handmatig (geen e-mail)" },
  { value: "invite", label: "Uitnodigen via e-mail" },
  { value: "minor", label: "Minderjarige sporter" },
] as const;

const INVITE_TYPES_FOR_PICKER: InviteTypeLiteral[] = [
  "parent_account",
  "trainer_account",
  "staff_account",
  "adult_athlete_account",
  "complete_registration",
];

const STAFF_LIKE_INVITE_TYPES: ReadonlySet<InviteTypeLiteral> = new Set([
  "trainer_account",
  "staff_account",
]);

export interface NewMemberFormProps {
  tenantId: string;
  existingParents: Array<{ id: string; full_name: string }>;
}

const inputCls =
  "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";
const inputStyle = {
  borderColor: "var(--surface-border)",
  color: "var(--text-primary)",
  backgroundColor: "var(--surface-main)",
} as const;

export function NewMemberForm({ tenantId, existingParents }: NewMemberFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDup, setConfirmDup] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<NewMemberWithInviteInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(newMemberWithInviteSchema) as any,
    defaultValues: {
      tenant_id: tenantId,
      mode: "manual",
      full_name: "",
      email: "",
      phone: "",
      roles: [],
      invite_type: "parent_account",
      parent_member_id: "",
      parent_email: "",
      confirm_duplicate: false,
    },
  });

  const mode = watch("mode");
  const inviteType = watch("invite_type");
  const isStaffInvite =
    mode === "invite" &&
    inviteType !== undefined &&
    STAFF_LIKE_INVITE_TYPES.has(inviteType);

  function onSubmit(values: NewMemberWithInviteInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await createMemberWithInvite({
        ...values,
        tenant_id: tenantId,
        confirm_duplicate: confirmDup,
      });
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      reset({
        tenant_id: tenantId,
        mode: "manual",
        full_name: "",
        email: "",
        phone: "",
        roles: [],
        invite_type: "parent_account",
        parent_member_id: "",
        parent_email: "",
        confirm_duplicate: false,
      });
      setConfirmDup(false);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-3 sm:grid-cols-2"
      noValidate
    >
      <input type="hidden" {...register("tenant_id")} value={tenantId} />

      <div className="sm:col-span-2">
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Aanmaakwijze
        </label>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <label
              key={m.value}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              <input type="radio" value={m.value} {...register("mode")} />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      <div className="sm:col-span-2">
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Volledige naam *
        </label>
        <input
          {...register("full_name")}
          className={inputCls}
          style={inputStyle}
          placeholder={mode === "minor" ? "Naam van het kind" : "Voor- en achternaam"}
        />
        {errors.full_name && (
          <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>
        )}
      </div>

      {mode !== "minor" && (
        <>
          <div>
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              E-mail{mode === "invite" ? " *" : ""}
            </label>
            <input
              type="email"
              {...register("email")}
              className={inputCls}
              style={inputStyle}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Telefoon
            </label>
            <input {...register("phone")} className={inputCls} style={inputStyle} />
          </div>
        </>
      )}

      {mode === "invite" && (
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Uitnodigingstype *
          </label>
          <select {...register("invite_type")} className={inputCls} style={inputStyle}>
            {INVITE_TYPES_FOR_PICKER.map((t) => (
              <option key={t} value={t}>
                {INVITE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {errors.invite_type && (
            <p className="mt-1 text-xs text-red-600">{errors.invite_type.message}</p>
          )}
          {isStaffInvite && (
            <p
              className="mt-1.5 text-[11px]"
              style={{ color: "var(--text-secondary)" }}
            >
              Het lid ontvangt een staf/trainer-template en hoeft alleen naam +
              wachtwoord in te vullen — geen speler/keeper-keuze of kinderen.
              Eventuele admin-rollen of kinderen kun je later toevoegen.
            </p>
          )}
        </div>
      )}

      {mode === "minor" && (
        <>
          <div className="sm:col-span-2">
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Bestaande ouder (optioneel)
            </label>
            <select
              {...register("parent_member_id")}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">— Geen — verstuur uitnodiging —</option>
              {existingParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Ouder e-mail (voor uitnodiging)
            </label>
            <input
              type="email"
              {...register("parent_email")}
              className={inputCls}
              style={inputStyle}
              placeholder="ouder@voorbeeld.nl"
            />
            {errors.parent_email && (
              <p className="mt-1 text-xs text-red-600">{errors.parent_email.message}</p>
            )}
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Vul één van beide velden in. Het kind krijgt zelf geen mail.
            </p>
          </div>
        </>
      )}

      <div className="sm:col-span-2">
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Rollen
        </label>
        <div className="flex flex-wrap gap-2">
          {MEMBER_ROLES.map((r) => (
            <label
              key={r}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            >
              <input
                type="checkbox"
                value={r}
                {...register("roles")}
                className="h-3.5 w-3.5"
              />
              {ROLE_LABELS[r]}
            </label>
          ))}
        </div>
      </div>

      {serverError && (
        <div className="sm:col-span-2 space-y-2">
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
                checked={confirmDup}
                onChange={(e) => setConfirmDup(e.target.checked)}
              />
              Toch aanmaken (negeer dubbele check)
            </label>
          )}
        </div>
      )}

      <div className="sm:col-span-2 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
        >
          <Plus className="h-4 w-4" />{" "}
          {pending
            ? "Bezig…"
            : mode === "manual"
              ? "Lid toevoegen"
              : mode === "minor"
                ? "Kind toevoegen"
                : "Lid + uitnodigen"}
        </button>
      </div>

      {/* Reference exports kept tree-shakeable */}
      <input type="hidden" value={INVITE_TYPES.join(",")} readOnly className="hidden" />
    </form>
  );
}
