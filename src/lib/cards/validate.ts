import {
  type Card,
  type ValidationResult,
  isFreeze,
  isWild,
} from "./types";

/**
 * Card Engine — group validators.
 *
 * Three primitive group types that card games compose into objectives:
 *   • set   — N cards sharing the same number (wilds substitute)
 *   • run   — N consecutive numbers (wilds fill gaps / extend ends)
 *   • color — N cards sharing the same color (wilds substitute)
 *
 * Rules common to all: a "Freeze" card can never be melded, and a group may not
 * be made entirely of wilds (at least one natural number card is required).
 */

interface Partition {
  naturals: Card[];
  wildCount: number;
  freezeCount: number;
}

function partition(cards: readonly Card[]): Partition {
  let wildCount = 0;
  let freezeCount = 0;
  const naturals: Card[] = [];
  for (const c of cards) {
    if (isWild(c)) wildCount++;
    else if (isFreeze(c)) freezeCount++;
    else naturals.push(c);
  }
  return { naturals, wildCount, freezeCount };
}

function basePrechecks(
  cards: readonly Card[],
  size: number,
  p: Partition,
): ValidationResult | null {
  if (cards.length !== size) {
    return { ok: false, reason: `Needs exactly ${size} cards` };
  }
  if (p.freezeCount > 0) {
    return { ok: false, reason: "Freeze cards can't be melded" };
  }
  if (p.naturals.length === 0) {
    return { ok: false, reason: "Needs at least one number card" };
  }
  return null;
}

/** All cards share the same number value (wilds substitute). */
export function validateSet(cards: readonly Card[], size: number): ValidationResult {
  const p = partition(cards);
  const pre = basePrechecks(cards, size, p);
  if (pre) return pre;

  const value = p.naturals[0]!.value;
  const allSame = p.naturals.every((c) => c.value === value);
  if (!allSame) {
    return { ok: false, reason: "Every card in a set must share the same number" };
  }
  return { ok: true };
}

/** Consecutive ascending numbers; color is irrelevant (wilds fill gaps). */
export function validateRun(cards: readonly Card[], size: number): ValidationResult {
  const p = partition(cards);
  const pre = basePrechecks(cards, size, p);
  if (pre) return pre;

  const values = p.naturals.map((c) => c.value!).sort((a, b) => a - b);
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1]) {
      return { ok: false, reason: "A run can't repeat the same number" };
    }
  }
  const spread = values[values.length - 1]! - values[0]!;
  if (spread > size - 1) {
    return { ok: false, reason: "Those numbers are too spread out for one run" };
  }
  // With distinct naturals and (size - naturals) wilds available, any spread
  // that fits the window can be completed into a valid consecutive run that
  // stays within the deck's number range. (Proof in the engine tests.)
  return { ok: true };
}

/** All cards share the same color (wilds substitute). */
export function validateColorGroup(
  cards: readonly Card[],
  size: number,
): ValidationResult {
  const p = partition(cards);
  const pre = basePrechecks(cards, size, p);
  if (pre) return pre;

  const color = p.naturals[0]!.color;
  const allSame = p.naturals.every((c) => c.color === color);
  if (!allSame) {
    return { ok: false, reason: "Every card must share the same color" };
  }
  return { ok: true };
}

export type GroupType = "set" | "run" | "color";

/** Dispatch to the validator for a given group type. */
export function validateGroup(
  type: GroupType,
  cards: readonly Card[],
  size: number,
): ValidationResult {
  switch (type) {
    case "set":
      return validateSet(cards, size);
    case "run":
      return validateRun(cards, size);
    case "color":
      return validateColorGroup(cards, size);
  }
}

/**
 * Can `card` be added ("hit") onto an already-melded group while keeping it
 * valid? Re-validates the group one size larger.
 */
export function canHit(
  type: GroupType,
  existing: readonly Card[],
  card: Card,
): ValidationResult {
  if (isFreeze(card)) {
    return { ok: false, reason: "Freeze cards can't be added to a meld" };
  }
  return validateGroup(type, [...existing, card], existing.length + 1);
}

/** Penalty points a card is worth if left in hand at round end. */
export function cardPenalty(card: Card): number {
  if (card.kind === "wild") return 25;
  if (card.kind === "freeze") return 15;
  const v = card.value ?? 0;
  return v >= 10 ? 10 : 5;
}

/** Total penalty for a hand of cards. */
export function handPenalty(cards: readonly Card[]): number {
  return cards.reduce((sum, c) => sum + cardPenalty(c), 0);
}

/** Stable display sort: by color, then value, wilds + freezes last. */
export function sortHand(cards: readonly Card[]): Card[] {
  const kindRank: Record<Card["kind"], number> = { number: 0, wild: 1, freeze: 2 };
  const colorRank: Record<string, number> = { red: 0, yellow: 1, green: 2, blue: 3 };
  return cards.slice().sort((a, b) => {
    if (a.kind !== b.kind) return kindRank[a.kind] - kindRank[b.kind];
    if (a.kind === "number") {
      const ca = colorRank[a.color ?? ""] ?? 9;
      const cb = colorRank[b.color ?? ""] ?? 9;
      if (ca !== cb) return ca - cb;
      return (a.value ?? 0) - (b.value ?? 0);
    }
    return a.id.localeCompare(b.id);
  });
}
