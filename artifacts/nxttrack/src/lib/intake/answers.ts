import type { IntakeFieldType } from "./types";

/**
 * Sprint 65 — Mapt een veld-waarde naar de juiste typed-kolom op
 * `submission_answers`. De server-action gebruikt deze helper om
 * de insert-payload op te bouwen.
 */
export interface AnswerInsertRow {
  field_key: string;
  field_id?: string | null;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_bool: boolean | null;
  value_json: unknown | null;
}

export function buildAnswerRow(args: {
  field_key: string;
  field_type: IntakeFieldType;
  field_id?: string | null;
  raw: unknown;
}): AnswerInsertRow {
  const { field_key, field_type, field_id, raw } = args;
  const row: AnswerInsertRow = {
    field_key,
    field_id: field_id ?? null,
    value_text: null,
    value_number: null,
    value_date: null,
    value_bool: null,
    value_json: null,
  };

  if (raw === null || raw === undefined || raw === "") return row;

  switch (field_type) {
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "select":
    case "radio":
      row.value_text = typeof raw === "string" ? raw : String(raw);
      break;
    case "date":
      row.value_date = typeof raw === "string" ? raw : null;
      break;
    case "number":
      row.value_number = typeof raw === "number" ? raw : Number(raw);
      if (Number.isNaN(row.value_number)) row.value_number = null;
      break;
    case "checkbox":
    case "consent":
      row.value_bool = Boolean(raw);
      break;
    case "multiselect":
      row.value_json = Array.isArray(raw) ? raw : [];
      break;
    default:
      row.value_json = raw;
  }
  return row;
}
