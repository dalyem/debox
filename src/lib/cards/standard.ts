// NOTE: shared/isomorphic modules use *relative* imports (not the `@/` alias)
// so that the Convex bundler — which does not resolve tsconfig path aliases —
// can include them server-side.
import { type Rng, shuffle } from "../platform/rng";

/**
 * Standard 52-card playing deck.
 *
 * The Debox "colored" deck (`./types`, `./deck`) backs Phase Cards. Traditional
 * card games — Spades, Cheat — instead need the familiar four-suit, thirteen-
 * rank deck. This module is the reusable, game-agnostic toolkit for that deck:
 * build, shuffle (seeded), deal, compare and sort. Like the colored deck, all
 * randomness is injected via an `Rng` so every shuffle is deterministic and
 * replayable from a seed.
 */

export type Suit = "clubs" | "diamonds" | "hearts" | "spades";

/** Display/sort order for suits (alternating colors, spades highest). */
export const SUITS: Suit[] = ["clubs", "diamonds", "hearts", "spades"];

/**
 * Rank as a comparable number, **aces high**: 2–10 are themselves, J=11, Q=12,
 * K=13, A=14. Storing ranks as numbers makes "highest card wins" a plain `>`.
 */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/**
 * The Cheat/Bullshit rank cycle, starting at Aces and looping through Kings:
 * A, 2, 3, …, 10, J, Q, K. (Aces are rank 14 but lead the cycle.)
 */
export const CHEAT_RANK_CYCLE: Rank[] = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export interface StandardCard {
  /** Stable unique id within a deck, e.g. "s14" (A♠), "h2" (2♥). */
  id: string;
  suit: Suit;
  rank: Rank;
}

const SUIT_CODE: Record<Suit, string> = {
  clubs: "c",
  diamonds: "d",
  hearts: "h",
  spades: "s",
};

const SUIT_SYMBOL: Record<Suit, string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

const RANK_LABEL: Record<Rank, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

/** Stable id for a (suit, rank) pair. */
export function cardId(suit: Suit, rank: Rank): string {
  return `${SUIT_CODE[suit]}${rank}`;
}

/** Build an ordered, un-shuffled 52-card deck with stable, unique ids. */
export function createStandardDeck(): StandardCard[] {
  const cards: StandardCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: cardId(suit, rank), suit, rank });
    }
  }
  return cards;
}

/** Shuffle a deck with the injected rng (pure, returns a new array). */
export function shuffleStandard(deck: readonly StandardCard[], rng: Rng): StandardCard[] {
  return shuffle(deck, rng);
}

/**
 * Deal exactly `perHand` cards to each of `handCount` players, round-robin.
 * Returns the hands plus any leftover cards. Throws if the deck is too small.
 */
export function dealHands(
  deck: readonly StandardCard[],
  handCount: number,
  perHand: number,
): { hands: StandardCard[][]; rest: StandardCard[] } {
  if (!Number.isInteger(handCount) || handCount <= 0) {
    throw new Error("handCount must be a positive integer");
  }
  if (!Number.isInteger(perHand) || perHand < 0) {
    throw new Error("perHand must be a non-negative integer");
  }
  if (deck.length < handCount * perHand) {
    throw new Error("Deck too small to deal the requested hands");
  }
  const hands: StandardCard[][] = Array.from({ length: handCount }, () => []);
  let cursor = 0;
  for (let round = 0; round < perHand; round++) {
    for (let p = 0; p < handCount; p++) {
      hands[p]!.push(deck[cursor]!);
      cursor++;
    }
  }
  return { hands, rest: deck.slice(cursor) };
}

/**
 * Deal the whole deck out as evenly as possible, round-robin. Earlier seats
 * receive the extra card(s) when the deck doesn't divide evenly. Used by Cheat.
 */
export function dealAll(
  deck: readonly StandardCard[],
  handCount: number,
): StandardCard[][] {
  if (handCount <= 0) throw new Error("handCount must be > 0");
  const hands: StandardCard[][] = Array.from({ length: handCount }, () => []);
  deck.forEach((card, i) => {
    hands[i % handCount]!.push(card);
  });
  return hands;
}

/**
 * Compare two cards by rank only (aces high). Negative if `a` < `b`. Suit is
 * ignored — trump/led-suit logic lives in the game engine, not here.
 */
export function compareRank(a: StandardCard, b: StandardCard): number {
  return a.rank - b.rank;
}

/** Compare two cards by suit using the canonical `SUITS` order. */
export function compareSuit(a: StandardCard, b: StandardCard): number {
  return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
}

/** Stable display sort: grouped by suit (canonical order), ascending rank. */
export function sortStandardHand(cards: readonly StandardCard[]): StandardCard[] {
  return cards.slice().sort((a, b) => compareSuit(a, b) || compareRank(a, b));
}

/** All cards of a given suit, ascending by rank. */
export function cardsOfSuit(cards: readonly StandardCard[], suit: Suit): StandardCard[] {
  return cards.filter((c) => c.suit === suit).sort(compareRank);
}

/** True for the red suits (hearts, diamonds). */
export function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOL[suit];
}

/** Short rank label: "A", "2"…"10", "J", "Q", "K". */
export function rankLabel(rank: Rank): string {
  return RANK_LABEL[rank];
}

/** Singular rank name: "Ace", "2"…"10", "Jack", "Queen", "King". */
export function rankSingular(rank: Rank): string {
  switch (rank) {
    case 11:
      return "Jack";
    case 12:
      return "Queen";
    case 13:
      return "King";
    case 14:
      return "Ace";
    default:
      return RANK_LABEL[rank];
  }
}

/** Pluralized rank name used for claims/required ranks: "Aces", "10s", "Kings". */
export function rankPlural(rank: Rank): string {
  switch (rank) {
    case 11:
      return "Jacks";
    case 12:
      return "Queens";
    case 13:
      return "Kings";
    case 14:
      return "Aces";
    case 6:
      return "6s";
    default:
      return `${RANK_LABEL[rank]}s`;
  }
}

/** Human label for a single card, e.g. "A♠", "10♥". Used in event toasts. */
export function describeStandardCard(card: StandardCard): string {
  return `${RANK_LABEL[card.rank]}${SUIT_SYMBOL[card.suit]}`;
}
