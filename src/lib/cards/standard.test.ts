import { describe, it, expect } from "vitest";
import { makeRng } from "@/lib/platform/rng";
import {
  CHEAT_RANK_CYCLE,
  type StandardCard,
  cardId,
  cardsOfSuit,
  compareRank,
  compareSuit,
  createStandardDeck,
  dealAll,
  dealHands,
  describeStandardCard,
  rankLabel,
  rankPlural,
  shuffleStandard,
  sortStandardHand,
} from "@/lib/cards/standard";

describe("createStandardDeck", () => {
  it("builds 52 unique cards, 13 per suit", () => {
    const deck = createStandardDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
    for (const suit of ["clubs", "diamonds", "hearts", "spades"] as const) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(13);
    }
  });

  it("uses stable ids", () => {
    expect(cardId("spades", 14)).toBe("s14");
    expect(cardId("hearts", 2)).toBe("h2");
  });
});

describe("shuffleStandard", () => {
  it("is deterministic for a given seed and preserves the multiset", () => {
    const deck = createStandardDeck();
    const a = shuffleStandard(deck, makeRng(42));
    const b = shuffleStandard(deck, makeRng(42));
    const c = shuffleStandard(deck, makeRng(43));
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(a.map((x) => x.id)).not.toEqual(c.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(52);
  });
});

describe("dealHands", () => {
  it("deals exactly perHand cards to each player with no overlap", () => {
    const deck = createStandardDeck();
    const { hands, rest } = dealHands(deck, 4, 13);
    expect(hands).toHaveLength(4);
    for (const h of hands) expect(h).toHaveLength(13);
    expect(rest).toHaveLength(0);
    const all = hands.flat().map((c) => c.id);
    expect(new Set(all).size).toBe(52);
  });

  it("throws when the deck is too small", () => {
    expect(() => dealHands(createStandardDeck(), 5, 13)).toThrow();
  });
});

describe("dealAll", () => {
  it("splits the whole deck as evenly as possible, extras to earlier seats", () => {
    const hands = dealAll(createStandardDeck(), 3);
    // 52 / 3 → 18, 17, 17
    expect(hands.map((h) => h.length)).toEqual([18, 17, 17]);
    expect(hands.flat()).toHaveLength(52);
    expect(new Set(hands.flat().map((c) => c.id)).size).toBe(52);
  });

  it("deals evenly when it divides", () => {
    const hands = dealAll(createStandardDeck(), 4);
    expect(hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
  });
});

describe("comparisons + sorting", () => {
  const card = (id: string, suit: StandardCard["suit"], rank: StandardCard["rank"]): StandardCard => ({
    id,
    suit,
    rank,
  });

  it("compares ranks aces-high", () => {
    expect(compareRank(card("a", "clubs", 14), card("b", "clubs", 13))).toBeGreaterThan(0);
    expect(compareRank(card("a", "clubs", 2), card("b", "clubs", 10))).toBeLessThan(0);
  });

  it("compares suits in canonical order (spades highest)", () => {
    expect(compareSuit(card("a", "spades", 2), card("b", "clubs", 2))).toBeGreaterThan(0);
    expect(compareSuit(card("a", "clubs", 2), card("b", "diamonds", 2))).toBeLessThan(0);
  });

  it("sorts a hand grouped by suit then ascending rank", () => {
    const hand = [
      card("s14", "spades", 14),
      card("c2", "clubs", 2),
      card("h7", "hearts", 7),
      card("c13", "clubs", 13),
    ];
    const sorted = sortStandardHand(hand).map((c) => c.id);
    expect(sorted).toEqual(["c2", "c13", "h7", "s14"]);
  });

  it("extracts a suit ascending", () => {
    const deck = createStandardDeck();
    const spades = cardsOfSuit(deck, "spades");
    expect(spades).toHaveLength(13);
    expect(spades[0]!.rank).toBe(2);
    expect(spades[12]!.rank).toBe(14);
  });
});

describe("labels", () => {
  it("labels ranks", () => {
    expect(rankLabel(14)).toBe("A");
    expect(rankLabel(11)).toBe("J");
    expect(rankLabel(10)).toBe("10");
  });

  it("pluralizes ranks for claims", () => {
    expect(rankPlural(14)).toBe("Aces");
    expect(rankPlural(13)).toBe("Kings");
    expect(rankPlural(6)).toBe("6s");
  });

  it("describes a card with rank + suit symbol", () => {
    expect(describeStandardCard({ id: "s14", suit: "spades", rank: 14 })).toBe("A♠");
  });

  it("cheat cycle starts at aces and runs to kings", () => {
    expect(CHEAT_RANK_CYCLE).toHaveLength(13);
    expect(CHEAT_RANK_CYCLE[0]).toBe(14);
    expect(CHEAT_RANK_CYCLE[12]).toBe(13);
  });
});
