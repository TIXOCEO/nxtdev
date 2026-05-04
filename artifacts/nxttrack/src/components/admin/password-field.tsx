"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff, Wand2 } from "lucide-react";
import { scorePassword, generateStrongPassword } from "@/lib/validation/password";

export interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  /** Show the colored strength meter under the input. Default true. */
  showStrength?: boolean;
  /** Show the "Generate" button on the right. Default true. */
  showGenerate?: boolean;
  disabled?: boolean;
}

/**
 * Reusable password input with show/hide toggle, strength meter, and a
 * generate button that emits a 16-char strong password via `onChange`.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { value, onChange, showStrength = true, showGenerate = true, disabled, ...rest },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const strength = scorePassword(value);

    return (
      <div className="space-y-1.5">
        <div className="relative">
          <input
            ref={ref}
            {...rest}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            autoComplete="new-password"
            className="h-10 w-full rounded-lg border bg-transparent pl-3 pr-20 text-sm outline-none transition-colors focus:border-[var(--accent)] disabled:opacity-60"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-main)",
            }}
          />
          <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
            {showGenerate && (
              <button
                type="button"
                onClick={() => onChange(generateStrongPassword())}
                disabled={disabled}
                title="Generate secure password"
                aria-label="Generate secure password"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/5 disabled:opacity-40"
                style={{ color: "var(--text-secondary)" }}
              >
                <Wand2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              disabled={disabled}
              title={visible ? "Hide password" : "Show password"}
              aria-label={visible ? "Hide password" : "Show password"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/5 disabled:opacity-40"
              style={{ color: "var(--text-secondary)" }}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {showStrength && (
          <div className="space-y-1">
            <div
              className="flex h-1 gap-1 overflow-hidden rounded-full"
              aria-hidden="true"
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      value && i < strength.score
                        ? strength.color
                        : "var(--surface-border)",
                  }}
                />
              ))}
            </div>
            <div
              className="flex items-center justify-between text-[11px]"
              style={{ color: "var(--text-secondary)" }}
            >
              <span>
                Strength:{" "}
                <span style={{ color: value ? strength.color : undefined }}>
                  {value ? strength.label : "—"}
                </span>
              </span>
              <span>Min 12 chars · upper, lower, digit, symbol</span>
            </div>
          </div>
        )}
      </div>
    );
  },
);
