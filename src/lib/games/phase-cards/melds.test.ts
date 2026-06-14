import { describe, it, expect } from "vitest";
import type { Card, CardColor } from "@/lib/cards";
import {
  applyHitToGroup,
  buildLaidGroup,
  canHitLaidGroup,
} from "@/lib/games/phase-cards/melds";

const num = (color: CardColor, value: number, copy = 0): Card => ({
  id: `${color}-${value}-${copy}`,
  kind: "number",
  color,
  value,
});
const wild = (i = 0): Card => ({ id: `wild-${i}`, kind: "wild", color: null, value: null });

describe("run melds", () => {
  it("locks wild values — can't add a value the wild already fills", () => {
    // 1, 2, [wild=3], 4 → window [1,4]
    const g = buildLaidGroup("run", "Run of 4", [
      num("red", 1),
      num("blue", 2),
      wild(),
      num("yellow", 4),
    ]);
    expect(g.lo).toBe(1);
    expect(g.hi).toBe(4);
    expect(canHitLaidGroup(g, num("green", 3)).ok).toBe(false); // locked by the wild
    expect(canHitLaidGroup(g, num("green", 5)).ok).toBe(true); // extends high end
    expect(canHitLaidGroup(g, num("green", 6)).ok).toBe(false); // not adjacent
  });

  it("extends a run at BOTH ends", () => {
    const g = buildLaidGroup("run", "Run of 4", [
      num("red", 5),
      num("blue", 6),
      num("green", 7),
      num("yellow", 8),
    ]);
    expect(g.lo).toBe(5);
    expect(g.hi).toBe(8);
    expect(canHitLaidGroup(g, num("red", 4)).ok).toBe(true); // low end
    expect(canHitLaidGroup(g, num("red", 9)).ok).toBe(true); // high end
    expect(canHitLaidGroup(g, num("red", 6)).ok).toBe(false); // duplicate
    expect(canHitLaidGroup(g, num("red", 10)).ok).toBe(false); // gap
  });

  it("extends the locked window after a hit", () => {
    let g = buildLaidGroup("run", "Run of 4", [
      num("red", 5),
      num("blue", 6),
      num("green", 7),
      num("yellow", 8),
    ]);
    g = applyHitToGroup(g, num("red", 9));
    expect(g.hi).toBe(9);
    expect(g.cards).toHaveLength(5);
    expect(canHitLaidGroup(g, num("red", 10)).ok).toBe(true);
  });

  it("won't extend a run beyond the deck range", () => {
    const g = buildLaidGroup("run", "Run of 9", [
      num("red", 4),
      num("blue", 5),
      num("green", 6),
      num("yellow", 7),
      num("red", 8, 1),
      num("blue", 9),
      num("green", 10),
      num("yellow", 11),
      num("red", 12),
    ]);
    expect(g.lo).toBe(4);
    expect(g.hi).toBe(12);
    expect(canHitLaidGroup(g, num("red", 13 as number)).ok).toBe(false);
    expect(canHitLaidGroup(g, num("red", 3)).ok).toBe(true); // low end only
  });

  it("sets still accept matching values or wilds (no ordering)", () => {
    const g = buildLaidGroup("set", "Set of 3", [
      num("red", 10),
      num("blue", 10),
      num("green", 10),
    ]);
    expect(canHitLaidGroup(g, num("yellow", 10)).ok).toBe(true);
    expect(canHitLaidGroup(g, wild()).ok).toBe(true);
    expect(canHitLaidGroup(g, num("yellow", 9)).ok).toBe(false);
  });
});
