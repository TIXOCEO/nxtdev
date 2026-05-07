import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TERMINOLOGY } from "../defaults.ts";
import { mergeIntoTerminology, resolveTerminology } from "../merge.ts";
import { safeParseTerminology } from "../schema.ts";

const FOOTBALL = {
  participant_singular: "Sporter",
  participant_plural: "Sporters",
  instructor_plural: "Trainers",
  session_plural: "Trainingen",
  program_page_title: "Abonnementen",
};

const GENERIC = {
  participant_singular: "Deelnemer",
  participant_plural: "Deelnemers",
  instructor_plural: "Begeleiders",
  session_plural: "Sessies",
  program_page_title: "Programma's",
};

describe("safeParseTerminology", () => {
  it("strips unknown keys", () => {
    const out = safeParseTerminology({ ...FOOTBALL, foo: "bar" });
    assert.equal((out as Record<string, unknown>).foo, undefined);
    assert.equal(out.participant_plural, "Sporters");
  });

  it("rejects empty / non-string values", () => {
    const out = safeParseTerminology({ participant_plural: "", instructor_plural: 42 });
    assert.equal(out.participant_plural, undefined);
    assert.equal(out.instructor_plural, undefined);
  });

  it("returns {} on garbage input (never throws)", () => {
    assert.deepEqual(safeParseTerminology(null), {});
    assert.deepEqual(safeParseTerminology(undefined), {});
    assert.deepEqual(safeParseTerminology("nope"), {});
    assert.deepEqual(safeParseTerminology(["arr"]), {});
    assert.deepEqual(safeParseTerminology(123), {});
  });
});

describe("mergeIntoTerminology", () => {
  it("returns base unchanged for invalid input", () => {
    const out = mergeIntoTerminology(DEFAULT_TERMINOLOGY, "garbage");
    assert.deepEqual(out, DEFAULT_TERMINOLOGY);
  });

  it("overlays valid partial on base", () => {
    const out = mergeIntoTerminology(DEFAULT_TERMINOLOGY, FOOTBALL);
    assert.equal(out.participant_plural, "Sporters");
    // unrelated keys stay
    assert.equal(out.member_plural, DEFAULT_TERMINOLOGY.member_plural);
  });
});

describe("resolveTerminology fallback chain", () => {
  it("falls back to TS default when no inputs provided", () => {
    const out = resolveTerminology({});
    assert.deepEqual(out, DEFAULT_TERMINOLOGY);
  });

  it("uses generic when no sector / overrides", () => {
    const out = resolveTerminology({ generic: GENERIC });
    assert.equal(out.participant_plural, "Deelnemers");
    assert.equal(out.session_plural, "Sessies");
  });

  it("sector beats generic", () => {
    const out = resolveTerminology({ generic: GENERIC, sector: FOOTBALL });
    assert.equal(out.participant_plural, "Sporters");
    assert.equal(out.session_plural, "Trainingen");
    assert.equal(out.program_page_title, "Abonnementen");
  });

  it("overrides beat sector and generic", () => {
    const out = resolveTerminology({
      generic: GENERIC,
      sector: FOOTBALL,
      overrides: { participant_plural: "Pupillen" },
    });
    assert.equal(out.participant_plural, "Pupillen");
    // sector still wins for non-overridden keys
    assert.equal(out.session_plural, "Trainingen");
  });

  it("ignores invalid override values, keeps lower layer", () => {
    const out = resolveTerminology({
      generic: GENERIC,
      sector: FOOTBALL,
      overrides: { participant_plural: "" },
    });
    assert.equal(out.participant_plural, "Sporters");
  });

  it("never throws on hostile input", () => {
    const cases: unknown[] = [null, undefined, 0, "x", [], { participant_plural: 5 }];
    for (const c of cases) {
      const out = resolveTerminology({ generic: c, sector: c, overrides: c });
      assert.ok(typeof out.member_plural === "string" && out.member_plural.length > 0);
    }
  });

  it("football_school template produces Houtrust-zero-regression labels", () => {
    const out = resolveTerminology({ generic: GENERIC, sector: FOOTBALL });
    assert.equal(out.member_plural, "Leden");
    assert.equal(out.group_plural, "Groepen");
    assert.equal(out.session_plural, "Trainingen");
    assert.equal(out.program_plural, DEFAULT_TERMINOLOGY.program_plural);
    assert.equal(out.program_page_title, "Abonnementen");
  });
});
