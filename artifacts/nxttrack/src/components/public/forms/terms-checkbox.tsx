"use client";

import { Check } from "lucide-react";

export interface TermsCheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  termsHref?: string;
}

export function TermsCheckbox({
  checked,
  onChange,
  disabled,
  termsHref = "#",
}: TermsCheckboxProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm select-none">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-50"
        style={{
          borderColor: checked ? "var(--tenant-accent)" : "var(--surface-border)",
          backgroundColor: checked ? "var(--tenant-accent)" : "var(--surface-main)",
        }}
      >
        {checked && <Check className="h-3.5 w-3.5" style={{ color: "var(--text-primary)" }} />}
      </button>
      <span style={{ color: "var(--text-primary)" }}>
        Ik ga akkoord met de{" "}
        <a
          href={termsHref}
          className="font-medium underline"
          style={{ color: "var(--text-primary)" }}
        >
          algemene voorwaarden
        </a>
        .
      </span>
    </label>
  );
}
