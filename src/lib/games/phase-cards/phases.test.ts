import { describe, it, expect } from "vitest";
import type { Card, CardColor } from "@/lib/cards";
import { PHASES, getPhase, validatePhase, TOTAL_PHASES } from "@/lib/games/phase-cards/phases";

const num = (color: CardColor, value: number, copy = 0): Card => ({
  id: `${color}-${value}-${copy}`,
  kind: "number",
  color,
  value,
});
const wild = (i = 0): Card => ({ id: `wild-${i}`, kind: "wild", color: null, value: null });

describe("phase ladder", () => {
  it("has ten phases matching the required progression", () => {
    expect(PHASES).toHaveLength(10);
    expect(TOTAL_PHASES).toBe(10);
    expect(PHASES.map((p) => p.requirements.map((r) => `${r.type}${r.count}`))).toEqual([
      ["set3", "set3"],
      ["set3", "run4"],
      ["set4", "run4"],
      ["run7"],
      ["run8"],
      ["run9"],
      ["set4", "set4"],
      ["color7"],
      ["set5", "set2"],
      ["set5", "set3"],
    ]);
  });
});

describe("validatePhase", () => {
  it("accepts a valid Phase 1 (two sets of 3) with a wild", () => {
    const res = validatePhase(getPhase(1), [
      [num("red", 7), num("blue", 7), num("green", 7)],
      [num("red", 4), num("blue", 4), wild()],
    ]);
    expect(res.ok).toBe(true);
  });

  it("accepts a valid Phase 2 (set of 3 + run of 4)", () => {
    const res = validatePhase(getPhase(2), [
      [num("red", 9), num("blue", 9), num("green", 9)],
      [num("red", 1), num("blue", 2), num("green", 3), num("yellow", 4)],
    ]);
    expect(res.ok).toBe(true);
  });

  it("accepts Phase 4 (run of 7) across colors", () => {
    const res = validatePhase(getPhase(4), [
      [
        num("red", 3),
        num("blue", 4),
        num("green", 5),
        num("yellow", 6),
        num("red", 7),
        num("blue", 8),
        num("green", 9),
      ],
    ]);
    expect(res.ok).toBe(true);
  });

  it("accepts Phase 8 (seven of one color) with a wild", () => {
    const res = validatePhase(getPhase(8), [
      [
        num("red", 1),
        num("red", 2),
        num("red", 3),
        num("red", 4),
        num("red", 5),
        num("red", 6),
        wild(),
      ],
    ]);
    expect(res.ok).toBe(true);
  });

  it("reports which slot failed", () => {
    const res = validatePhase(getPhase(1), [
      [num("red", 7), num("blue", 7), num("green", 7)],
      [num("red", 4), num("blue", 5), num("green", 6)],
    ]);
    expect(res.ok).toBe(false);
    expect(res.slots[0]!.ok).toBe(true);
    expect(res.slots[1]!.ok).toBe(false);
  });

  it("rejects re-using the same physical card across groups", () => {
    const shared = num("red", 7);
    const res = validatePhase(getPhase(1), [
      [shared, num("blue", 7), num("green", 7)],
      [shared, num("blue", 4), num("green", 4)],
    ]);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/two groups/i);
  });

  it("rejects the wrong number of groups", () => {
    const res = validatePhase(getPhase(1), [
      [num("red", 7), num("blue", 7), num("green", 7)],
    ]);
    expect(res.ok).toBe(false);
  });
});
