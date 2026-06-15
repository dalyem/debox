/**
 * Pure helpers for the draggable hand fan. Kept free of React/DOM so the fiddly
 * index math is unit-testable on its own.
 */

/**
 * How many card centers sit to the left of the pointer — i.e. the index at
 * which a card dropped at `x` should be inserted among the others. `centers`
 * must be sorted ascending (left → right).
 */
export function insertionIndex(centers: number[], x: number): number {
  return centers.reduce((n, cx) => (cx < x ? n + 1 : n), 0);
}

/**
 * Move `cardId` to `toIndex` among the *other* cards (the index the hand
 * previews while dragging), clamped to a valid slot. Returns the original array
 * reference when nothing actually moves, so callers can skip a re-render.
 */
export function reorderHand(
  order: string[],
  cardId: string,
  toIndex: number,
): string[] {
  const without = order.filter((id) => id !== cardId);
  if (without.length === order.length) return order; // card wasn't in the hand
  const clamped = Math.max(0, Math.min(toIndex, without.length));
  without.splice(clamped, 0, cardId);
  return without.every((id, i) => id === order[i]) ? order : without;
}
