import { describe, it, expect } from "vitest";
import { makeRng } from "@/lib/platform/rng";
import {
  ANSWERS,
  VALID_GUESSES,
  WORD_LENGTH,
  isValidGuess,
  pickAnswer,
} from "@/lib/games/word-rush/words";

const FIVE = new RegExp(`^[a-z]{${WORD_LENGTH}}$`);

describe("word list integrity", () => {
  it("every answer is exactly five lowercase letters", () => {
    const bad = ANSWERS.filter((w) => !FIVE.test(w));
    expect(bad).toEqual([]);
  });

  it("every accepted guess is exactly five lowercase letters", () => {
    const bad = [...VALID_GUESSES].filter((w) => !FIVE.test(w));
    expect(bad).toEqual([]);
  });

  it("answers contain no duplicates", () => {
    expect(ANSWERS.length).toBe(new Set(ANSWERS).size);
  });

  it("has a healthy pool to draw from", () => {
    expect(ANSWERS.length).toBeGreaterThan(150);
    expect(VALID_GUESSES.size).toBeGreaterThan(ANSWERS.length);
  });

  it("every answer is itself a valid guess", () => {
    const missing = ANSWERS.filter((w) => !VALID_GUESSES.has(w));
    expect(missing).toEqual([]);
  });

  it("accepts popular opener words", () => {
    for (const opener of ["adieu", "audio", "stare", "crane", "raise", "slate", "trace", "roast"]) {
      expect(isValidGuess(opener)).toBe(true);
    }
  });

  it("rejects non-words and wrong lengths", () => {
    expect(isValidGuess("zzzzz")).toBe(false);
    expect(isValidGuess("cat")).toBe(false);
    expect(isValidGuess("abcdef")).toBe(false);
    expect(isValidGuess("12345")).toBe(false);
    expect(isValidGuess("st re")).toBe(false);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isValidGuess("  STARE ")).toBe(true);
  });
});

describe("pickAnswer", () => {
  it("returns an uppercase answer from the pool", () => {
    const w = pickAnswer(makeRng(123));
    expect(w).toBe(w.toUpperCase());
    expect(ANSWERS).toContain(w.toLowerCase());
  });

  it("is deterministic for a given seed", () => {
    expect(pickAnswer(makeRng(42))).toBe(pickAnswer(makeRng(42)));
  });

  it("avoids excluded words", () => {
    const exclude = ANSWERS.slice(0, ANSWERS.length - 1);
    const last = ANSWERS[ANSWERS.length - 1]!;
    expect(pickAnswer(makeRng(7), exclude)).toBe(last.toUpperCase());
  });
});
