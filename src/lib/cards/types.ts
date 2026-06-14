/**
 * Card Engine — types.
 *
 * A small, reusable card framework. It is deliberately generic: a `Card` can be
 * a numbered color card, a wild, or a "freeze" (skip) card. Future games
 * (an Uno-style game, a rummy variant, etc.) can reuse the deck builder,
 * shuffler and group validators without modification.
 *
 * Terminology is original to Debox — there is no reference to any existing
 * commercial product. Colors are generic, the skip card is a "Freeze", and the
 * any-card is a "Shift" (wild).
 */

export type CardColor = "red" | "blue" | "green" | "yellow";

export const CARD_COLORS: CardColor[] = ["red", "blue", "green", "yellow"];

export type CardKind = "number" | "wild" | "freeze";

export interface Card {
  /** Stable unique id within a single deck instance (e.g. "red-7-a"). */
  id: string;
  kind: CardKind;
  /** Present for `number` cards; `null` for wild / freeze. */
  color: CardColor | null;
  /** Present for `number` cards; `null` for wild / freeze. */
  value: number | null;
}

export interface DeckSpec {
  colors: CardColor[];
  /** Inclusive lowest number value. */
  minValue: number;
  /** Inclusive highest number value. */
  maxValue: number;
  /** How many copies of each (color, value) pair. */
  copiesPerNumber: number;
  /** Number of wild ("Shift") cards. */
  wildCount: number;
  /** Number of skip ("Freeze") cards. */
  freezeCount: number;
}

/**
 * The canonical Debox deck: numbers 1–12 in four colors (two copies each) plus
 * 8 Shift wilds and 4 Freeze skips = 108 cards.
 */
export const DEBOX_DECK: DeckSpec = {
  colors: CARD_COLORS,
  minValue: 1,
  maxValue: 12,
  copiesPerNumber: 2,
  wildCount: 8,
  freezeCount: 4,
};

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export const isNumberCard = (c: Card): boolean => c.kind === "number";
export const isWild = (c: Card): boolean => c.kind === "wild";
export const isFreeze = (c: Card): boolean => c.kind === "freeze";
