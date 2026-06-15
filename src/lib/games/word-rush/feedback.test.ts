import { describe, it, expect } from "vitest";
import {
  evaluateGuess,
  isAllCorrect,
  mergeKeyboard,
} from "@/lib/games/word-rush/feedback";
import type { TileState } from "@/lib/games/word-rush/types";

describe("evaluateGuess", () => {
  it("marks an exact match all correct", () => {
    expect(evaluateGuess("CRANE", "CRANE")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });

  it("marks a total miss all absent", () => {
    expect(evaluateGuess("FUSTY", "CRIMP")).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
  });

  it("greens before yellows, capping duplicate letters (ALLEY vs LEVEL)", () => {
    expect(evaluateGuess("ALLEY", "LEVEL")).toEqual([
      "absent",
      "present",
      "present",
      "correct",
      "absent",
    ]);
  });

  it("handles duplicate guess letters against the answer (ERASE vs SPEED)", () => {
    expect(evaluateGuess("ERASE", "SPEED")).toEqual([
      "present",
      "absent",
      "absent",
      "present",
      "present",
    ]);
  });

  it("is case-insensitive", () => {
    expect(evaluateGuess("crane", "crane").every((t) => t === "correct")).toBe(true);
  });
});

describe("isAllCorrect", () => {
  it("is true only when every tile is correct", () => {
    expect(isAllCorrect(["correct", "correct", "correct"])).toBe(true);
    expect(isAllCorrect(["correct", "present", "correct"])).toBe(false);
    expect(isAllCorrect([])).toBe(false);
  });
});

describe("mergeKeyboard", () => {
  it("keeps the best status per letter and never downgrades", () => {
    let kb: Record<string, TileState> = {};
    // S present, then later S correct -> stays correct.
    kb = mergeKeyboard(kb, "STARE", ["present", "absent", "absent", "absent", "absent"]);
    expect(kb.S).toBe("present");
    kb = mergeKeyboard(kb, "SLATE", ["correct", "absent", "absent", "absent", "absent"]);
    expect(kb.S).toBe("correct");
    // A correct should not be downgraded to present by a later guess.
    kb = mergeKeyboard(kb, "ABBEY", ["correct", "absent", "absent", "absent", "absent"]);
    kb = mergeKeyboard(kb, "PAINT", ["absent", "present", "absent", "absent", "absent"]);
    expect(kb.A).toBe("correct");
  });
});
