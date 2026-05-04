"use client";

import { useEffect, useMemo, useState } from "react";

export interface DateSelectFieldProps {
  /** ISO yyyy-mm-dd or empty string. */
  value: string;
  onChange: (iso: string) => void;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  ariaLabelDay?: string;
  ariaLabelMonth?: string;
  ariaLabelYear?: string;
}

const MONTHS_NL = [
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December",
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

/**
 * Three-segment day/month/year selector. Avoids the native date input
 * (poor mobile UX, locale-inconsistent rendering). Output is a strict
 * ISO date `yyyy-mm-dd` whenever all three parts are filled, otherwise
 * an empty string.
 */
export function DateSelectField({
  value,
  onChange,
  minYear,
  maxYear,
  disabled,
  ariaLabelDay = "Dag",
  ariaLabelMonth = "Maand",
  ariaLabelYear = "Jaar",
}: DateSelectFieldProps) {
  const now = new Date();
  const yMax = maxYear ?? now.getFullYear();
  const yMin = minYear ?? yMax - 100;

  // Parse the parent's ISO value (if any) into parts.
  const parsed = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
    if (!m) return { y: "", mo: "", d: "" };
    return { y: m[1], mo: m[2], d: m[3] };
  }, [value]);

  // Keep partial selections locally — the parent only learns about the
  // value once all three parts are picked. Without this, picking the day
  // first (with month/year still empty) would emit "" upstream and the
  // controlled <select> would snap back to "Dag", making the field feel
  // broken.
  const [dd, setDd] = useState(parsed.d);
  const [mm, setMm] = useState(parsed.mo);
  const [yyyy, setYyyy] = useState(parsed.y);

  // If the parent value changes externally (e.g. form reset), resync.
  useEffect(() => {
    setDd(parsed.d);
    setMm(parsed.mo);
    setYyyy(parsed.y);
  }, [parsed.d, parsed.mo, parsed.y]);

  const yearNum = Number(yyyy) || 0;
  const monthNum = Number(mm) || 0;
  const dayCount = daysInMonth(yearNum, monthNum);

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = yMax; y >= yMin; y--) out.push(y);
    return out;
  }, [yMax, yMin]);

  const emit = (parts: { d: string; m: string; y: string }) => {
    const { d, m, y } = parts;
    if (d && m && y) {
      // Clamp day to month max (e.g. Feb 30 → Feb 28/29)
      const max = daysInMonth(Number(y), Number(m));
      const clamped = Math.min(Number(d), max);
      const clampedStr = pad(clamped);
      if (clampedStr !== d) setDd(clampedStr);
      onChange(`${y}-${m}-${clampedStr}`);
    } else if (value) {
      // Parts no longer complete but parent still holds an ISO date —
      // clear it so validation accurately reflects the missing field.
      onChange("");
    }
  };

  const handleDay = (d: string) => {
    setDd(d);
    emit({ d, m: mm, y: yyyy });
  };
  const handleMonth = (m: string) => {
    setMm(m);
    emit({ d: dd, m, y: yyyy });
  };
  const handleYear = (y: string) => {
    setYyyy(y);
    emit({ d: dd, m: mm, y });
  };

  const selectStyle: React.CSSProperties = {
    borderColor: "var(--surface-border)",
    color: "var(--text-primary)",
    backgroundColor: "var(--surface-main)",
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        aria-label={ariaLabelDay}
        disabled={disabled}
        value={dd}
        onChange={(e) => handleDay(e.target.value)}
        className="h-10 rounded-lg border bg-transparent px-2 text-sm outline-none focus:border-[var(--tenant-accent)] disabled:opacity-50"
        style={selectStyle}
      >
        <option value="">Dag</option>
        {Array.from({ length: dayCount }, (_, i) => pad(i + 1)).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        aria-label={ariaLabelMonth}
        disabled={disabled}
        value={mm}
        onChange={(e) => handleMonth(e.target.value)}
        className="h-10 rounded-lg border bg-transparent px-2 text-sm outline-none focus:border-[var(--tenant-accent)] disabled:opacity-50"
        style={selectStyle}
      >
        <option value="">Maand</option>
        {MONTHS_NL.map((label, i) => (
          <option key={label} value={pad(i + 1)}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label={ariaLabelYear}
        disabled={disabled}
        value={yyyy}
        onChange={(e) => handleYear(e.target.value)}
        className="h-10 rounded-lg border bg-transparent px-2 text-sm outline-none focus:border-[var(--tenant-accent)] disabled:opacity-50"
        style={selectStyle}
      >
        <option value="">Jaar</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
