import { type Card, type ValidationResult, isFreeze, isWild } from "../../cards/types";
import { validateGroup } from "../../cards/validate";
import type { LaidGroup } from "./types";

/**
 * Laid-meld helpers — in particular, correct RUN hitting.
 *
 * A run, once laid, occupies a fixed window of consecutive values `[lo, hi]`.
 * Any wild in it is *locked* to the value it fills (Phase 10 rule: a played wild
 * can't later be "moved"). So a run can only grow by one at either end —
 * `lo - 1` or `hi + 1` — and never by a value already covered (which would be a
 * duplicate of a locked wild). Sets/colors have no ordering, so they just
 * re-validate one card larger.
 */

const DECK_MIN = 1;
const DECK_MAX = 12;

/** Compute the locked value window a freshly-laid run occupies. */
export function computeRunRange(cards: Card[]): { lo: number; hi: number } {
  const len = cards.length;
  const values = cards
    .filter((c) => c.kind === "number")
    .map((c) => c.value!)
    .sort((a, b) => a - b);
  const m = values[0] ?? DECK_MIN;
  const M = values[values.length - 1] ?? len;
  // Place the window as low as possible while still covering all naturals and
  // staying in range — deterministic when wilds could sit at either end.
  let lo = Math.max(DECK_MIN, M - len + 1);
  lo = Math.min(lo, m);
  lo = Math.max(DECK_MIN, Math.min(lo, DECK_MAX - len + 1));
  return { lo, hi: lo + len - 1 };
}

/** Order a run's cards left→right by value, wilds sitting in their filled slots. */
export function orderRun(cards: Card[], lo: number, hi: number): Card[] {
  const byValue = new Map<number, Card>();
  for (const c of cards) if (c.kind === "number") byValue.set(c.value!, c);
  const wilds = cards.filter((c) => c.kind === "wild");
  const ordered: Card[] = [];
  for (let v = lo; v <= hi; v++) {
    const nat = byValue.get(v);
    ordered.push(nat ?? wilds.shift() ?? cards[0]!);
  }
  return ordered.length === cards.length ? ordered : cards;
}

function rangeOf(group: LaidGroup): { lo: number; hi: number } {
  if (typeof group.lo === "number" && typeof group.hi === "number") {
    return { lo: group.lo, hi: group.hi };
  }
  return computeRunRange(group.cards);
}

/** Can `card` be added to this laid meld? Runs use the locked-window rule. */
export function canHitLaidGroup(group: LaidGroup, card: Card): ValidationResult {
  if (isFreeze(card)) {
    return { ok: false, reason: "Freeze cards can't be added to a meld" };
  }
  if (group.type === "set" || group.type === "color") {
    return validateGroup(group.type, [...group.cards, card], group.cards.length + 1);
  }
  // run
  const { lo, hi } = rangeOf(group);
  if (isWild(card)) {
    return lo > DECK_MIN || hi < DECK_MAX
      ? { ok: true }
      : { ok: false, reason: "This run can't grow any further" };
  }
  const v = card.value!;
  if (v === lo - 1 && v >= DECK_MIN) return { ok: true };
  if (v === hi + 1 && v <= DECK_MAX) return { ok: true };
  return { ok: false, reason: "Add to the run's low or high end" };
}

/** Build a laid group from cards (computing + sorting the run window). */
export function buildLaidGroup(
  type: LaidGroup["type"],
  label: string,
  cards: Card[],
): LaidGroup {
  if (type === "run") {
    const { lo, hi } = computeRunRange(cards);
    return { type, count: cards.length, label, cards: orderRun(cards, lo, hi), lo, hi };
  }
  return { type, count: cards.length, label, cards };
}

/** Apply a validated hit, returning the updated group (extends the run window). */
export function applyHitToGroup(group: LaidGroup, card: Card): LaidGroup {
  if (group.type !== "run") {
    return { ...group, cards: [...group.cards, card], count: group.cards.length + 1 };
  }
  const { lo, hi } = rangeOf(group);
  let newLo = lo;
  let newHi = hi;
  if (isWild(card)) {
    if (hi < DECK_MAX) newHi = hi + 1;
    else newLo = lo - 1;
  } else if (card.value === lo - 1) {
    newLo = lo - 1;
  } else {
    newHi = hi + 1;
  }
  const cards = [...group.cards, card];
  return {
    ...group,
    cards: orderRun(cards, newLo, newHi),
    count: cards.length,
    lo: newLo,
    hi: newHi,
  };
}
