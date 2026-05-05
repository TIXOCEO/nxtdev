"use client";

import { type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export interface WizardStepDef {
  id: string;
  label: string;
}

export interface WizardProps {
  children: ReactNode;
  className?: string;
}

export function Wizard({ children, className }: WizardProps) {
  return (
    <div
      className={`rounded-[var(--radius-nxt-lg)] border p-5 sm:p-6 ${className ?? ""}`}
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
        boxShadow: "var(--shadow-app)",
      }}
    >
      {children}
    </div>
  );
}

export interface WizardProgressProps {
  steps: WizardStepDef[];
  current: number;
  accentColor: string;
}

export function WizardProgress({
  steps,
  current,
  accentColor,
}: WizardProgressProps) {
  return (
    <ol
      className="mb-6 flex items-center gap-1.5 sm:gap-2"
      aria-label="Voortgang"
    >
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2 min-w-0">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold"
              style={{
                backgroundColor: done || active ? accentColor : "transparent",
                borderColor:
                  done || active ? accentColor : "var(--surface-border)",
                color:
                  done || active ? "#fff" : "var(--text-secondary)",
              }}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={`hidden truncate text-xs sm:inline ${active ? "font-semibold" : ""}`}
              style={{
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span
                className="h-px flex-1"
                style={{ backgroundColor: "var(--surface-border)" }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export interface WizardStepProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function WizardStep({
  title,
  description,
  children,
}: WizardStepProps) {
  return (
    <div>
      <h3
        className="text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

export interface WizardNavProps {
  current: number;
  total: number;
  pending: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  accentColor: string;
  nextLabel?: string;
  submitLabel?: string;
}

export function WizardNav({
  current,
  total,
  pending,
  onPrev,
  onNext,
  onSubmit,
  accentColor,
  nextLabel = "Volgende",
  submitLabel = "Verzenden",
}: WizardNavProps) {
  const last = current === total - 1;
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={current === 0 || pending}
        className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40"
        style={{
          borderColor: "var(--surface-border)",
          color: "var(--text-primary)",
        }}
      >
        <ChevronLeft className="h-4 w-4" /> Terug
      </button>
      {last ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ backgroundColor: accentColor, color: "#fff" }}
        >
          {pending ? "Versturen…" : submitLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ backgroundColor: accentColor, color: "#fff" }}
        >
          {nextLabel} <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
