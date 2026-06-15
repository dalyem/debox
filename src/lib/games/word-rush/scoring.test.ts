import { describe, it, expect } from "vitest";
import {
  accuracyPoints,
  lockWindowMs,
  placementPoints,
  solveScore,
} from "@/lib/games/word-rush/scoring";
import type { WordRushConfig } from "@/lib/games/word-rush/types";

const config: WordRushConfig = {
  wordLength: 5,
  maxGuesses: 6,
  targetScore: 50,
  maxRounds: 5,
  strictDictionary: true,
  lockBaseMs: 120_000,
  lockPerExtraPlayerMs: 30_000,
  lockStepMs: 45_000,
  lockMinTailMs: 10_000,
  failPenalty: -3,
};

describe("accuracyPoints", () => {
  it("rewards fewer guesses, floored at 1", () => {
    expect(accuracyPoints(1, 6)).toBe(6);
    expect(accuracyPoints(2, 6)).toBe(5);
    expect(accuracyPoints(6, 6)).toBe(1);
    expect(accuracyPoints(7, 6)).toBe(1);
  });
});

describe("placementPoints", () => {
  it("pays a podium bonus by finish order", () => {
    expect(placementPoints(1)).toBe(5);
    expect(placementPoints(2)).toBe(3);
    expect(placementPoints(3)).toBe(2);
    expect(placementPoints(4)).toBe(1);
    expect(placementPoints(8)).toBe(1);
  });
});

describe("solveScore", () => {
  it("combines accuracy and placement", () => {
    expect(solveScore(1, 1, config)).toBe(11); // 6 + 5
    expect(solveScore(3, 2, config)).toBe(7); // 4 + 3
    expect(solveScore(6, 4, config)).toBe(2); // 1 + 1
  });

  it("keeps the max attainable round below the target so 50 takes a sprint", () => {
    expect(solveScore(1, 1, config) * config.maxRounds).toBeLessThan(
      config.targetScore + 10,
    );
  });
});

describe("lockWindowMs", () => {
  it("is the base for two players and grows per extra player", () => {
    expect(lockWindowMs(2, config)).toBe(120_000);
    expect(lockWindowMs(3, config)).toBe(150_000);
    expect(lockWindowMs(4, config)).toBe(180_000);
    expect(lockWindowMs(8, config)).toBe(300_000);
  });

  it("never drops below the base for tiny rooms", () => {
    expect(lockWindowMs(1, config)).toBe(120_000);
  });
});
