// NOTE: shared/isomorphic modules use *relative* imports (not the `@/` alias)
// so that the Convex bundler — which does not resolve tsconfig path aliases —
// can include them server-side.
import { type Rng, shuffle } from "../platform/rng";
import { type Card, type DeckSpec, DEBOX_DECK } from "./types";

/**
 * Card Engine — deck operations.
 *
 * `createDeck` is deterministic (stable ids + order). All randomness is injected
 * via an `Rng`, so the same seed always produces the same shuffle/deal.
 */

/** Build an ordered, un-shuffled deck from a spec. Ids are stable + unique. */
export function createDeck(spec: DeckSpec = DEBOX_DECK): Card[] {
  const cards: Card[] = [];
  for (const color of spec.colors) {
    for (let value = spec.minValue; value <= spec.maxValue; value++) {
      for (let copy = 0; copy < spec.copiesPerNumber; copy++) {
        cards.push({
          id: `${color}-${value}-${copy}`,
          kind: "number",
          color,
          value,
        });
      }
    }
  }
  for (let i = 0; i < spec.wildCount; i++) {
    cards.push({ id: `wild-${i}`, kind: "wild", color: null, value: null });
  }
  for (let i = 0; i < spec.freezeCount; i++) {
    cards.push({ id: `freeze-${i}`, kind: "freeze", color: null, value: null });
  }
  return cards;
}

/** Shuffle a deck with the injected rng (pure, returns a new array). */
export function shuffleDeck(deck: readonly Card[], rng: Rng): Card[] {
  return shuffle(deck, rng);
}

export interface DealResult {
  hands: Card[][];
  /** Remaining cards become the draw pile (top of pile = last element). */
  drawPile: Card[];
}

/**
 * Deal `perHand` cards to `handCount` players, round-robin. Returns the hands
 * and the leftover draw pile. Throws if the deck is too small.
 */
export function dealCards(
  deck: readonly Card[],
  handCount: number,
  perHand: number,
): DealResult {
  if (handCount <= 0) throw new Error("handCount must be > 0");
  if (deck.length < handCount * perHand + 1) {
    throw new Error("Deck too small to deal the requested hands");
  }
  const hands: Card[][] = Array.from({ length: handCount }, () => []);
  const remaining = deck.slice();
  let cursor = 0;
  for (let round = 0; round < perHand; round++) {
    for (let p = 0; p < handCount; p++) {
      hands[p]!.push(remaining[cursor]!);
      cursor++;
    }
  }
  return { hands, drawPile: remaining.slice(cursor) };
}

/** Draw the top card from a pile (top = last element). Pure. */
export function drawCard(pile: readonly Card[]): { card: Card; pile: Card[] } {
  if (pile.length === 0) throw new Error("Cannot draw from an empty pile");
  const next = pile.slice();
  const card = next.pop()!;
  return { card, pile: next };
}

/** Place a card on top of a pile (top = last element). Pure. */
export function discardCard(pile: readonly Card[], card: Card): Card[] {
  return [...pile, card];
}

/** Peek the top card of a pile without removing it. */
export function topOf(pile: readonly Card[]): Card | null {
  return pile.length > 0 ? pile[pile.length - 1]! : null;
}

/**
 * When the draw pile is exhausted, recycle the discard pile (keeping its top
 * card in play) back into a freshly shuffled draw pile.
 */
export function recycleDiscard(
  discardPile: readonly Card[],
  rng: Rng,
): { drawPile: Card[]; discardPile: Card[] } {
  if (discardPile.length <= 1) {
    return { drawPile: [], discardPile: discardPile.slice() };
  }
  const top = discardPile[discardPile.length - 1]!;
  const rest = discardPile.slice(0, -1);
  return { drawPile: shuffle(rest, rng), discardPile: [top] };
}
