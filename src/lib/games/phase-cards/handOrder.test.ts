import { describe, expect, it } from "vitest";
import { insertionIndex, reorderHand } from "./handOrder";

describe("insertionIndex", () => {
  const centers = [10, 30, 50, 70]; // four cards, left → right

  it("returns 0 when the pointer is left of every card", () => {
    expect(insertionIndex(centers, 0)).toBe(0);
  });

  it("returns the count beyond the last card on the far right", () => {
    expect(insertionIndex(centers, 100)).toBe(4);
  });

  it("counts the centers strictly to the left of the pointer", () => {
    expect(insertionIndex(centers, 40)).toBe(2); // past 10 and 30
    expect(insertionIndex(centers, 60)).toBe(3); // past 10, 30, 50
  });

  it("is empty-safe (a one-card hand has no other centers)", () => {
    expect(insertionIndex([], 123)).toBe(0);
  });
});

describe("reorderHand", () => {
  const hand = ["a", "b", "c", "d"];

  it("moves a card to the front", () => {
    expect(reorderHand(hand, "c", 0)).toEqual(["c", "a", "b", "d"]);
  });

  it("moves a card to the end", () => {
    expect(reorderHand(hand, "b", 3)).toEqual(["a", "c", "d", "b"]);
  });

  it("inserts at an interior index measured among the other cards", () => {
    // remove "a" → [b,c,d]; insert at 2 → between c and d
    expect(reorderHand(hand, "a", 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("clamps an out-of-range index instead of dropping the card", () => {
    expect(reorderHand(hand, "a", 99)).toEqual(["b", "c", "d", "a"]);
    expect(reorderHand(hand, "d", -5)).toEqual(["d", "a", "b", "c"]);
  });

  it("returns the SAME reference when the card lands back where it was", () => {
    // "b" sits at index 1; among [a,c,d] that's insertion index 1.
    const result = reorderHand(hand, "b", 1);
    expect(result).toBe(hand);
  });

  it("returns the same reference for an unknown card", () => {
    const result = reorderHand(hand, "zzz", 0);
    expect(result).toBe(hand);
  });
});
