import { describe, it, expect } from "vitest";
import { isFieldVisible } from "../build-schema";
import type { IntakeShowIf } from "../types";

/**
 * Sprint 82 — show_if-engine ondersteunt operators `equals`, `not_equals`
 * en `in`, met prioriteit `in` > `not_equals` > `equals`. Backwards
 * compatible: oude rows met alleen `equals` blijven 1:1 werken.
 *
 * Coercion: booleans → Boolean(actual), numbers → Number(actual), anders
 * String(actual ?? "") === String(expected). Deze tests bevriezen dat
 * gedrag zodat een wijziging in `valueMatches` direct opvalt.
 */

describe("isFieldVisible — geen show_if", () => {
  it("zichtbaar wanneer show_if null/undefined is", () => {
    expect(isFieldVisible(null, {})).toBe(true);
    expect(isFieldVisible(undefined, {})).toBe(true);
  });

  it("zichtbaar wanneer show_if leeg object is (geen criterium)", () => {
    const showIf = { field_key: "x" } as IntakeShowIf;
    expect(isFieldVisible(showIf, { x: "anything" })).toBe(true);
  });
});

describe("isFieldVisible — equals (legacy)", () => {
  const showIf: IntakeShowIf = { field_key: "had_lessons", equals: "ja" };

  it("match → zichtbaar", () => {
    expect(isFieldVisible(showIf, { had_lessons: "ja" })).toBe(true);
  });

  it("mismatch → verborgen", () => {
    expect(isFieldVisible(showIf, { had_lessons: "nee" })).toBe(false);
  });

  it("ontbrekende waarde → verborgen", () => {
    expect(isFieldVisible(showIf, {})).toBe(false);
  });
});

describe("isFieldVisible — not_equals", () => {
  const showIf: IntakeShowIf = { field_key: "had_lessons", not_equals: "nee" };

  it("waarde anders dan not_equals → zichtbaar", () => {
    expect(isFieldVisible(showIf, { had_lessons: "ja" })).toBe(true);
  });

  it("waarde gelijk aan not_equals → verborgen", () => {
    expect(isFieldVisible(showIf, { had_lessons: "nee" })).toBe(false);
  });

  it("ontbrekende waarde → zichtbaar (undefined != 'nee')", () => {
    expect(isFieldVisible(showIf, {})).toBe(true);
  });
});

describe("isFieldVisible — in (array)", () => {
  const showIf: IntakeShowIf = {
    field_key: "level",
    in: ["A", "B", "C"],
  };

  it("waarde in lijst → zichtbaar", () => {
    expect(isFieldVisible(showIf, { level: "B" })).toBe(true);
  });

  it("waarde niet in lijst → verborgen", () => {
    expect(isFieldVisible(showIf, { level: "Z" })).toBe(false);
  });

  it("lege array → verborgen (geen match mogelijk)", () => {
    const empty: IntakeShowIf = { field_key: "x", in: [] };
    expect(isFieldVisible(empty, { x: "anything" })).toBe(false);
  });
});

describe("isFieldVisible — operator-prioriteit (in > not_equals > equals)", () => {
  it("`in` wint van `equals` wanneer beide aanwezig", () => {
    const showIf: IntakeShowIf = {
      field_key: "x",
      in: ["ja"],
      equals: "nee",
    };
    expect(isFieldVisible(showIf, { x: "ja" })).toBe(true);
    expect(isFieldVisible(showIf, { x: "nee" })).toBe(false);
  });

  it("`not_equals` wint van `equals` wanneer beide aanwezig", () => {
    const showIf: IntakeShowIf = {
      field_key: "x",
      not_equals: "nee",
      equals: "ja",
    };
    expect(isFieldVisible(showIf, { x: "ja" })).toBe(true);
    expect(isFieldVisible(showIf, { x: "nee" })).toBe(false);
    expect(isFieldVisible(showIf, { x: "maybe" })).toBe(true);
  });
});

describe("isFieldVisible — coercion van boolean", () => {
  const showIf: IntakeShowIf = { field_key: "agreed", equals: true };

  it("true match", () => {
    expect(isFieldVisible(showIf, { agreed: true })).toBe(true);
  });

  it("truthy string telt als true (Boolean('ja')=true)", () => {
    expect(isFieldVisible(showIf, { agreed: "ja" })).toBe(true);
  });

  it("falsy waarde → niet zichtbaar", () => {
    expect(isFieldVisible(showIf, { agreed: false })).toBe(false);
    expect(isFieldVisible(showIf, { agreed: "" })).toBe(false);
    expect(isFieldVisible(showIf, { agreed: 0 })).toBe(false);
    expect(isFieldVisible(showIf, {})).toBe(false);
  });

  it("expected:false → undefined matcht (beide falsy)", () => {
    const sf: IntakeShowIf = { field_key: "agreed", equals: false };
    expect(isFieldVisible(sf, { agreed: false })).toBe(true);
    expect(isFieldVisible(sf, {})).toBe(true);
    expect(isFieldVisible(sf, { agreed: true })).toBe(false);
  });
});

describe("isFieldVisible — coercion van number", () => {
  const showIf: IntakeShowIf = { field_key: "age", equals: 8 };

  it("number match", () => {
    expect(isFieldVisible(showIf, { age: 8 })).toBe(true);
  });

  it("numeric string match (Number('8')===8)", () => {
    expect(isFieldVisible(showIf, { age: "8" })).toBe(true);
  });

  it("andere number → verborgen", () => {
    expect(isFieldVisible(showIf, { age: 9 })).toBe(false);
    expect(isFieldVisible(showIf, { age: "9" })).toBe(false);
  });

  it("number-coercion werkt ook in `in`-operator", () => {
    const sf: IntakeShowIf = { field_key: "age", in: [6, 7, 8] };
    expect(isFieldVisible(sf, { age: "7" })).toBe(true);
    expect(isFieldVisible(sf, { age: 10 })).toBe(false);
  });
});
