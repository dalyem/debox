import { describe, it, expect } from "vitest";
import { makeRng } from "@/lib/platform/rng";
import {
  type Card,
  type CardColor,
  createDeck,
  shuffleDeck,
  dealCards,
  drawCard,
  discardCard,
  recycleDiscard,
  validateSet,
  validateRun,
  validateColorGroup,
  canHit,
  cardPenalty,
  handPenalty,
  DEBOX_DECK,
} from "@/lib/cards";

const num = (color: CardColor, value: number, copy = 0): Card => ({
  id: `${color}-${value}-${copy}`,
  kind: "number",
  color,
  value,
});
const wild = (i = 0): Card => ({ id: `wild-${i}`, kind: "wild", color: null, value: null });
const freeze = (i = 0): Card => ({
  id: `freeze-${i}`,
  kind: "freeze",
  color: null,
  value: null,
});

describe("createDeck", () => {
  it("builds the canonical 108-card Debox deck", () => {
    const deck = createDeck(DEBOX_DECK);
    expect(deck).toHaveLength(108);
    expect(deck.filter((c) => c.kind === "number")).toHaveLength(96);
    expect(deck.filter((c) => c.kind === "wild")).toHaveLength(8);
    expect(deck.filter((c) => c.kind === "freeze")).toHaveLength(4);
  });

  it("gives every card a unique id", () => {
    const deck = createDeck();
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
  });
});

describe("shuffleDeck", () => {
  it("is deterministic for a given seed and a permutation of the input", () => {
    const deck = createDeck();
    const a = shuffleDeck(deck, makeRng(42));
    const b = shuffleDeck(deck, makeRng(42));
    const c = shuffleDeck(deck, makeRng(43));
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(a.map((x) => x.id)).not.toEqual(c.map((x) => x.id));
    expect(new Set(a.map((x) => x.id))).toEqual(new Set(deck.map((x) => x.id)));
  });
});

describe("dealCards", () => {
  it("deals round-robin and leaves the rest as a draw pile", () => {
    const deck = createDeck();
    const { hands, drawPile } = dealCards(deck, 4, 10);
    expect(hands).toHaveLength(4);
    hands.forEach((h) => expect(h).toHaveLength(10));
    expect(drawPile).toHaveLength(108 - 40);
  });

  it("throws when the deck is too small", () => {
    expect(() => dealCards(createDeck(), 11, 10)).toThrow();
  });
});

describe("draw / discard / recycle", () => {
  it("draws from the top and discards onto the top", () => {
    const pile = [num("red", 1), num("red", 2), num("red", 3)];
    const { card, pile: rest } = drawCard(pile);
    expect(card.value).toBe(3);
    expect(rest).toHaveLength(2);
    const after = discardCard(rest, card);
    expect(after[after.length - 1]).toEqual(card);
  });

  it("recycles the discard pile but keeps the top card in play", () => {
    const discard = [num("red", 1), num("blue", 2), num("green", 3)];
    const { drawPile, discardPile } = recycleDiscard(discard, makeRng(1));
    expect(discardPile).toHaveLength(1);
    expect(discardPile[0]!.value).toBe(3);
    expect(drawPile).toHaveLength(2);
  });
});

describe("validateSet", () => {
  it("accepts matching numbers across colors", () => {
    expect(validateSet([num("red", 3), num("blue", 3), num("green", 3)], 3).ok).toBe(true);
  });
  it("accepts wilds as substitutes", () => {
    expect(validateSet([num("red", 3), num("blue", 3), wild()], 3).ok).toBe(true);
  });
  it("rejects mismatched numbers", () => {
    expect(validateSet([num("red", 3), num("blue", 4), num("green", 3)], 3).ok).toBe(false);
  });
  it("rejects the wrong size", () => {
    expect(validateSet([num("red", 3), num("blue", 3)], 3).ok).toBe(false);
  });
  it("rejects all-wild groups and freezes", () => {
    expect(validateSet([wild(0), wild(1), wild(2)], 3).ok).toBe(false);
    expect(validateSet([num("red", 3), num("blue", 3), freeze()], 3).ok).toBe(false);
  });
});

describe("validateRun", () => {
  it("accepts consecutive numbers regardless of color", () => {
    expect(
      validateRun([num("red", 1), num("blue", 2), num("green", 3), num("yellow", 4)], 4).ok,
    ).toBe(true);
  });
  it("accepts wilds that fill internal gaps", () => {
    expect(validateRun([num("red", 1), num("red", 2), wild(), num("red", 4)], 4).ok).toBe(true);
  });
  it("accepts wilds that extend the ends", () => {
    expect(validateRun([num("red", 5), wild(0), wild(1)], 3).ok).toBe(true);
  });
  it("rejects spreads too wide for the run length", () => {
    expect(validateRun([num("red", 1), num("red", 3), num("red", 5)], 3).ok).toBe(false);
  });
  it("rejects duplicate numbers", () => {
    expect(validateRun([num("red", 1, 0), num("blue", 1, 1), num("red", 2)], 3).ok).toBe(false);
  });
});

describe("validateColorGroup", () => {
  it("accepts same-color cards with any numbers", () => {
    expect(
      validateColorGroup([num("red", 1), num("red", 5), num("red", 9)], 3).ok,
    ).toBe(true);
  });
  it("accepts wilds as substitutes", () => {
    expect(validateColorGroup([num("red", 1), num("red", 5), wild()], 3).ok).toBe(true);
  });
  it("rejects mixed colors", () => {
    expect(
      validateColorGroup([num("red", 1), num("red", 5), num("blue", 9)], 3).ok,
    ).toBe(false);
  });
});

describe("canHit", () => {
  const set = [num("red", 3), num("blue", 3), num("green", 3)];
  const run = [num("red", 1), num("blue", 2), num("green", 3)];
  const color = [num("red", 1), num("red", 5), num("red", 9)];

  it("extends sets with same value or wild", () => {
    expect(canHit("set", set, num("yellow", 3)).ok).toBe(true);
    expect(canHit("set", set, wild()).ok).toBe(true);
    expect(canHit("set", set, num("yellow", 4)).ok).toBe(false);
  });
  it("extends runs at either end and rejects gaps/dupes", () => {
    expect(canHit("run", run, num("yellow", 4)).ok).toBe(true);
    expect(canHit("run", run, wild()).ok).toBe(true);
    expect(canHit("run", run, num("red", 1)).ok).toBe(false);
    expect(canHit("run", run, num("yellow", 9)).ok).toBe(false);
  });
  it("extends color groups with same color or wild", () => {
    expect(canHit("color", color, num("red", 2)).ok).toBe(true);
    expect(canHit("color", color, wild()).ok).toBe(true);
    expect(canHit("color", color, num("blue", 2)).ok).toBe(false);
  });
  it("never accepts a freeze", () => {
    expect(canHit("set", set, freeze()).ok).toBe(false);
  });
});

describe("scoring", () => {
  it("weights cards by the Debox penalty table", () => {
    expect(cardPenalty(num("red", 5))).toBe(5);
    expect(cardPenalty(num("red", 9))).toBe(5);
    expect(cardPenalty(num("red", 10))).toBe(10);
    expect(cardPenalty(num("red", 12))).toBe(10);
    expect(cardPenalty(freeze())).toBe(15);
    expect(cardPenalty(wild())).toBe(25);
    expect(handPenalty([num("red", 5), num("red", 12), wild(), freeze()])).toBe(55);
  });
});
