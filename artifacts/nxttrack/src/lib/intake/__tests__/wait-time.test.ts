import { describe, it, expect } from "vitest";
import {
  getWaitEstimate,
  labelForWaitWeeks,
  toneForWaitWeeks,
} from "../wait-time";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sprint 82 — Tone-mapping voor wachttijd:
 *   weeks == null       → green ("onbekend" wordt mild getoond)
 *   weeks <= 2          → green
 *   weeks <= 8          → yellow
 *   weeks  > 8          → red
 *
 * En `getWaitEstimate` doet een select op
 * `program_group_waitlist_estimate` met kolomnamen
 * `current_waitlist_count` / `estimated_wait_weeks`. We
 * bevriezen het column-contract via een mock — wijzigt iemand
 * de viewdefinitie of de TS-select, dan faalt deze test.
 */

describe("toneForWaitWeeks — boundaries", () => {
  it("null/undefined → green", () => {
    expect(toneForWaitWeeks(null)).toBe("green");
    expect(toneForWaitWeeks(undefined)).toBe("green");
  });

  it("0..2 weken → green", () => {
    expect(toneForWaitWeeks(0)).toBe("green");
    expect(toneForWaitWeeks(1)).toBe("green");
    expect(toneForWaitWeeks(2)).toBe("green");
  });

  it("3..8 weken → yellow", () => {
    expect(toneForWaitWeeks(3)).toBe("yellow");
    expect(toneForWaitWeeks(5)).toBe("yellow");
    expect(toneForWaitWeeks(8)).toBe("yellow");
  });

  it(">8 weken → red", () => {
    expect(toneForWaitWeeks(9)).toBe("red");
    expect(toneForWaitWeeks(20)).toBe("red");
    expect(toneForWaitWeeks(52)).toBe("red");
  });
});

describe("labelForWaitWeeks", () => {
  it("null → 'Wachttijd onbekend'", () => {
    expect(labelForWaitWeeks(null)).toBe("Wachttijd onbekend");
  });

  it("0 → 'Direct plek'", () => {
    expect(labelForWaitWeeks(0)).toBe("Direct plek");
  });

  it("1 → '± 1 week wachttijd' (enkelvoud)", () => {
    expect(labelForWaitWeeks(1)).toBe("± 1 week wachttijd");
  });

  it("≥2 → '± N weken wachttijd' (meervoud)", () => {
    expect(labelForWaitWeeks(2)).toBe("± 2 weken wachttijd");
    expect(labelForWaitWeeks(12)).toBe("± 12 weken wachttijd");
  });
});

/**
 * Mock-supabase die de fluent-builder mimickt en de laatste
 * gestelde filters/select-cols vastlegt, zodat we kunnen
 * verifiëren dat de query exact de view-kolommen aanvraagt.
 */
interface MockState {
  table: string | null;
  select: string | null;
  filters: Array<{ op: string; col: string; val: unknown }>;
  rows: Array<Record<string, unknown>>;
}

function makeMockSupabase(rows: Array<Record<string, unknown>>): {
  client: SupabaseClient;
  state: MockState;
} {
  const state: MockState = {
    table: null,
    select: null,
    filters: [],
    rows,
  };

  function makeBuilder(): unknown {
    const builder = {
      select(cols: string) {
        state.select = cols;
        return builder;
      },
      eq(col: string, val: unknown) {
        state.filters.push({ op: "eq", col, val });
        return builder;
      },
      is(col: string, val: unknown) {
        state.filters.push({ op: "is", col, val });
        return Promise.resolve({ data: state.rows, error: null });
      },
      limit(_n: number) {
        return builder;
      },
      then(resolve: (v: unknown) => void) {
        resolve({ data: state.rows, error: null });
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      state.table = table;
      return makeBuilder();
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

describe("getWaitEstimate — query-contract", () => {
  it("queryt de juiste view en kolommen (column-contract bevroren)", async () => {
    const { client, state } = makeMockSupabase([
      {
        group_id: "g1",
        stage_id: null,
        open_slots: 3,
        current_waitlist_count: 0,
        estimated_wait_weeks: 0,
      },
    ]);
    await getWaitEstimate(client, {
      tenantId: "t1",
      groupId: "g1",
      stageId: null,
    });
    expect(state.table).toBe("program_group_waitlist_estimate");
    expect(state.select).toBeTruthy();
    expect(state.select).toMatch(/group_id/);
    expect(state.select).toMatch(/stage_id/);
    expect(state.select).toMatch(/open_slots/);
    expect(state.select).toMatch(/current_waitlist_count/);
    expect(state.select).toMatch(/estimated_wait_weeks/);
  });

  it("tenantId + groupId worden als eq-filter meegegeven", async () => {
    const { client, state } = makeMockSupabase([]);
    await getWaitEstimate(client, {
      tenantId: "t1",
      groupId: "g1",
      stageId: "s1",
    });
    expect(
      state.filters.find((f) => f.op === "eq" && f.col === "tenant_id")?.val,
    ).toBe("t1");
    expect(
      state.filters.find((f) => f.op === "eq" && f.col === "group_id")?.val,
    ).toBe("g1");
    expect(
      state.filters.find((f) => f.op === "eq" && f.col === "stage_id")?.val,
    ).toBe("s1");
  });

  it("stageId=null → `.is(stage_id, null)` i.p.v. `.eq(...)`", async () => {
    const { client, state } = makeMockSupabase([]);
    await getWaitEstimate(client, {
      tenantId: "t1",
      groupId: "g1",
      stageId: null,
    });
    expect(
      state.filters.find((f) => f.op === "is" && f.col === "stage_id")?.val,
    ).toBe(null);
  });

  it("retourneert estimated_wait_weeks uit de rij", async () => {
    const { client } = makeMockSupabase([
      {
        group_id: "g1",
        stage_id: null,
        open_slots: 0,
        current_waitlist_count: 5,
        estimated_wait_weeks: 20,
      },
    ]);
    const weeks = await getWaitEstimate(client, {
      tenantId: "t1",
      groupId: "g1",
      stageId: null,
    });
    expect(weeks).toBe(20);
    expect(toneForWaitWeeks(weeks)).toBe("red");
  });

  it("retourneert null wanneer view geen rij oplevert", async () => {
    const { client } = makeMockSupabase([]);
    const weeks = await getWaitEstimate(client, {
      tenantId: "t1",
      groupId: "g-onbekend",
      stageId: null,
    });
    expect(weeks).toBe(null);
  });

  it("samengestelde flow: open_slots>0 in view → 0 weken → green", async () => {
    const { client } = makeMockSupabase([
      {
        group_id: "g1",
        stage_id: null,
        open_slots: 2,
        current_waitlist_count: 0,
        estimated_wait_weeks: 0,
      },
    ]);
    const weeks = await getWaitEstimate(client, {
      tenantId: "t1",
      groupId: "g1",
      stageId: null,
    });
    expect(weeks).toBe(0);
    expect(toneForWaitWeeks(weeks)).toBe("green");
    expect(labelForWaitWeeks(weeks)).toBe("Direct plek");
  });
});
