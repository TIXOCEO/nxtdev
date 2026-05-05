"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import {
  acceptMinorParentSchema,
  type AcceptMinorParentInput,
} from "@/lib/validation/invites";
import { acceptMinorParentInvite } from "@/lib/actions/tenant/invites";
import { scorePassword } from "@/lib/validation/password";

export interface AcceptMinorDirectFormProps {
  token: string;
  email: string;
  defaultName: string;
  childName: string | null;
  tenantSlug: string;
  accentColor: string;
}

const inputCls =
  "h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-50";

function PasswordRequirements({ value }: { value: string }) {
  const checks = [
    { ok: value.length >= 8, label: "Minimaal 8 tekens" },
    { ok: /[A-Z]/.test(value), label: "Hoofdletter (A-Z)" },
    { ok: /[a-z]/.test(value), label: "Kleine letter (a-z)" },
    { ok: /[0-9]/.test(value), label: "Cijfer (0-9)" },
    { ok: /[^A-Za-z0-9]/.test(value), label: "Speciaal teken (! @ # …)" },
  ];
  return (
    <ul
      className="mt-1.5 space-y-0.5 text-[11px]"
      style={{ color: "var(--text-secondary)" }}
    >
      {checks.map((c) => (
        <li key={c.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            style={{ color: c.ok ? "#16a34a" : "var(--text-secondary)" }}
          >
            {c.ok ? "✓" : "•"}
          </span>
          <span style={{ color: c.ok ? "#16a34a" : undefined }}>{c.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function AcceptMinorDirectForm({
  token,
  email,
  defaultName,
  childName,
  tenantSlug,
  accentColor,
}: AcceptMinorDirectFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<{ child: string | null } | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<AcceptMinorParentInput>({
    resolver: zodResolver(
      acceptMinorParentSchema,
    ) as Resolver<AcceptMinorParentInput>,
    defaultValues: {
      token,
      full_name: defaultName,
      password: "",
      password_confirm: "",
    },
  });

  const pwdValue = watch("password") ?? "";
  const strength = scorePassword(pwdValue);

  function onSubmit(values: AcceptMinorParentInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await acceptMinorParentInvite({ ...values, token });
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      setDone({ child: res.data.child_full_name });
      // Admin-API user creation maakt geen sessie aan; stuur de ouder naar
      // de tenant-login met een `next` zodat ze meteen in hun profiel
      // landen na het inloggen met het zojuist gekozen wachtwoord.
      setTimeout(
        () =>
          router.push(
            `/t/${tenantSlug}/login?next=${encodeURIComponent(
              `/t/${tenantSlug}/profile`,
            )}`,
          ),
        1800,
      );
    });
  }

  if (done) {
    const linkedName = done.child ?? childName;
    const loginHref = `/t/${tenantSlug}/login?next=${encodeURIComponent(
      `/t/${tenantSlug}/profile`,
    )}`;
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-8 w-8" style={{ color: accentColor }} />
        <h2
          className="mt-2 text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Welkom!
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {linkedName
            ? `Je bent gekoppeld aan ${linkedName}.`
            : "Je bent gekoppeld aan het kind."}
        </p>
        <p className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          We sturen je door naar het inlogscherm…
        </p>
        <Link
          href={loginHref}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold"
          style={{ backgroundColor: accentColor, color: "#fff" }}
        >
          Naar mijn profiel
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <p className="text-sm" style={{ color: "var(--text-primary)" }}>
        Maak een ouder-account aan om gekoppeld te worden aan{" "}
        <strong>{childName ?? "je kind"}</strong>.
      </p>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Geen aparte koppelcode nodig — we koppelen je direct na registratie.
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
          Jouw volledige naam *
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
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <div className="relative">
              <input
                {...field}
                type={showPwd ? "text" : "password"}
                autoComplete="new-password"
                className={`${inputCls} pr-10`}
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute inset-y-0 right-2 inline-flex items-center text-[var(--text-secondary)]"
                aria-label={showPwd ? "Verberg wachtwoord" : "Toon wachtwoord"}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
        />
        {pwdValue && (
          <div className="mt-1.5">
            <div className="flex h-1 gap-1 overflow-hidden rounded-full" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      i < strength.score ? strength.color : "var(--surface-border)",
                  }}
                />
              ))}
            </div>
            <p className="mt-1 text-[11px]" style={{ color: strength.color }}>
              Sterkte: {strength.label}
            </p>
          </div>
        )}
        <PasswordRequirements value={pwdValue} />
        {errors.password && (
          <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
        )}
      </div>

      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Bevestig wachtwoord *
        </label>
        <div className="relative">
          <input
            {...register("password_confirm")}
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            className={`${inputCls} pr-10`}
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute inset-y-0 right-2 inline-flex items-center text-[var(--text-secondary)]"
            aria-label={showConfirm ? "Verberg wachtwoord" : "Toon wachtwoord"}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password_confirm && (
          <p className="mt-1 text-xs text-red-600">
            {errors.password_confirm.message}
          </p>
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
        {pending ? "Bezig…" : "Account activeren en koppelen"}
      </button>
    </form>
  );
}
