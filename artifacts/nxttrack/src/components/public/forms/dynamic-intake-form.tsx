"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { submitIntake } from "@/lib/actions/public/intake";
import { isFieldVisible } from "@/lib/intake/build-schema";
import type {
  IntakeFormConfig,
  IntakeFormFieldConfig,
  IntakeSubmissionType,
} from "@/lib/intake/types";

/**
 * Sprint 65 — Dynamische intake-renderer.
 *
 * Renderer-only client component. Validatie + insert gebeurt server-side
 * via `submitIntake`; we tonen field-errors die door de action worden
 * teruggegeven.
 */

export interface DynamicIntakeFormProps {
  tenantSlug: string;
  form: IntakeFormConfig;
  /**
   * Override van het submission_type voor pages die met dezelfde
   * form-config een ander funnel willen markeren (toekomstige programs).
   * MVP gebruikt de waarde uit `form.submission_type`.
   */
  submissionType?: IntakeSubmissionType;
}

type Values = Record<string, unknown>;

function emptyDefaults(form: IntakeFormConfig): Values {
  const v: Values = {};
  for (const f of form.fields) {
    if (f.field_type === "checkbox" || f.field_type === "consent")
      v[f.key] = false;
    else if (f.field_type === "multiselect") v[f.key] = [];
    else v[f.key] = "";
  }
  return v;
}

function FieldLabel({ field }: { field: IntakeFormFieldConfig }) {
  return (
    <label
      htmlFor={field.key}
      className="text-sm font-medium"
      style={{ color: "var(--text-primary)" }}
    >
      {field.label}
      {field.is_required ? (
        <span style={{ color: "var(--danger, #c0392b)" }}> *</span>
      ) : null}
    </label>
  );
}

const baseInputStyle = {
  border: "1px solid var(--border)",
  backgroundColor: "var(--surface)",
  color: "var(--text-primary)",
} as const;

export function DynamicIntakeForm({
  tenantSlug,
  form,
}: DynamicIntakeFormProps) {
  const [values, setValues] = useState<Values>(() => emptyDefaults(form));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const visibleFields = useMemo(
    () => form.fields.filter((f) => isFieldVisible(f.show_if, values)),
    [form.fields, values],
  );

  function set(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      const next = { ...errors };
      delete next[key];
      setErrors(next);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setErrors({});
    startTransition(async () => {
      const res = await submitIntake({
        tenant_slug: tenantSlug,
        submission_type: form.submission_type,
        form_slug: form.slug,
        answers: values,
      });
      if (res.ok) {
        setSuccess(true);
        setValues(emptyDefaults(form));
      } else {
        setServerError(res.error);
        if (res.fieldErrors) setErrors(res.fieldErrors);
      }
    });
  }

  if (success) {
    return (
      <div
        className="rounded-2xl p-5 sm:p-6"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5" style={{ color: "var(--tenant-accent)" }} />
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Aanvraag ontvangen
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              We hebben je aanvraag ontvangen. We nemen zo snel mogelijk contact met je op.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl p-5 sm:p-6"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      {visibleFields.map((field) => {
        const err = errors[field.key]?.[0];
        const id = field.key;
        const val = values[field.key];

        let control: React.ReactNode = null;
        switch (field.field_type) {
          case "text":
          case "email":
          case "phone":
            control = (
              <input
                id={id}
                type={field.field_type === "email" ? "email" : field.field_type === "phone" ? "tel" : "text"}
                value={(val as string) ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={baseInputStyle}
                autoComplete={
                  field.field_type === "email"
                    ? "email"
                    : field.field_type === "phone"
                    ? "tel"
                    : "off"
                }
              />
            );
            break;
          case "textarea":
            control = (
              <textarea
                id={id}
                value={(val as string) ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                rows={4}
                maxLength={field.validation?.maxLength ?? 2000}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={baseInputStyle}
              />
            );
            break;
          case "date":
            control = (
              <input
                id={id}
                type="date"
                value={(val as string) ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={baseInputStyle}
              />
            );
            break;
          case "number":
            control = (
              <input
                id={id}
                type="number"
                value={(val as number | string) ?? ""}
                min={field.validation?.min}
                max={field.validation?.max}
                onChange={(e) => set(field.key, e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={baseInputStyle}
              />
            );
            break;
          case "select":
            control = (
              <select
                id={id}
                value={(val as string) ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={baseInputStyle}
              >
                <option value="">— Maak een keuze —</option>
                {(field.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
            break;
          case "radio":
            control = (
              <div className="flex flex-col gap-2">
                {(field.options ?? []).map((o) => (
                  <label key={o.value} className="inline-flex items-center gap-2 text-sm"
                    style={{ color: "var(--text-primary)" }}>
                    <input
                      type="radio"
                      name={id}
                      value={o.value}
                      checked={(val as string) === o.value}
                      onChange={() => set(field.key, o.value)}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            );
            break;
          case "multiselect":
            control = (
              <div className="flex flex-col gap-2">
                {(field.options ?? []).map((o) => {
                  const arr = Array.isArray(val) ? (val as string[]) : [];
                  const checked = arr.includes(o.value);
                  return (
                    <label key={o.value} className="inline-flex items-center gap-2 text-sm"
                      style={{ color: "var(--text-primary)" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...arr, o.value]
                            : arr.filter((x) => x !== o.value);
                          set(field.key, next);
                        }}
                      />
                      <span>{o.label}</span>
                    </label>
                  );
                })}
              </div>
            );
            break;
          case "checkbox":
          case "consent":
            control = (
              <label className="inline-flex items-start gap-2 text-sm"
                style={{ color: "var(--text-primary)" }}>
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(val)}
                  onChange={(e) => set(field.key, e.target.checked)}
                  className="mt-1"
                />
                <span>{field.label}</span>
              </label>
            );
            break;
        }

        // Checkbox/consent rendert eigen label; voor andere types tonen we de FieldLabel.
        const showOuterLabel =
          field.field_type !== "checkbox" && field.field_type !== "consent";

        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            {showOuterLabel ? <FieldLabel field={field} /> : null}
            {control}
            {field.help_text ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {field.help_text}
              </p>
            ) : null}
            {err ? (
              <p className="text-xs" style={{ color: "var(--danger, #c0392b)" }}>
                {err}
              </p>
            ) : null}
          </div>
        );
      })}

      {serverError ? (
        <p className="text-sm" style={{ color: "var(--danger, #c0392b)" }}>
          {serverError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60"
        style={{
          backgroundColor: "var(--tenant-accent)",
          color: "var(--tenant-accent-foreground, white)",
        }}
      >
        <Send className="h-4 w-4" />
        {pending ? "Bezig met versturen…" : "Verstuur aanvraag"}
      </button>
    </form>
  );
}
