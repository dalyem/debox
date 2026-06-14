/**
 * Turn Engine — reusable, game-agnostic turn-order progression.
 *
 * Games describe their participants as an ordered list of ids plus a direction
 * and a queue of pending "skips". The engine computes the next participant,
 * honoring skips and an optional eligibility predicate (used to pass over
 * disconnected players or players who have finished). It is fully pure so it can
 * run identically on the Convex server and in client previews.
 */

export interface TurnOrder {
  /** Participant ids in fixed seat order. */
  order: string[];
  /** The id whose turn it currently is. */
  currentId: string;
  /** +1 = clockwise through `order`, -1 = counter-clockwise. */
  direction: 1 | -1;
  /** Map of participantId -> number of upcoming turns to skip. */
  pendingSkips: Record<string, number>;
}

export interface AdvanceOptions {
  /** Return false to skip a participant entirely (e.g. inactive/finished). */
  isEligible?: (id: string) => boolean;
}

export interface AdvanceResult {
  currentId: string;
  pendingSkips: Record<string, number>;
  /** Ids that were skipped this advance (for event/animation purposes). */
  skipped: string[];
}

function indexOfOrThrow(order: string[], id: string): number {
  const idx = order.indexOf(id);
  if (idx === -1) throw new Error(`Turn participant "${id}" not in order`);
  return idx;
}

/**
 * Advance to the next participant. Consumes one queued skip per skipped player
 * and passes over ineligible players. Guards against an infinite loop when no
 * one is eligible by returning the current id unchanged.
 */
export function advanceTurn(turn: TurnOrder, opts: AdvanceOptions = {}): AdvanceResult {
  const { order, direction } = turn;
  const isEligible = opts.isEligible ?? (() => true);
  const pendingSkips = { ...turn.pendingSkips };
  const skipped: string[] = [];

  if (order.length === 0) {
    return { currentId: turn.currentId, pendingSkips, skipped };
  }

  let idx = indexOfOrThrow(order, turn.currentId);
  const n = order.length;

  // Bounded by n*2 steps: at most one full lap of eligibility checks plus one
  // full lap of skip consumption.
  for (let guard = 0; guard < n * 2 + 1; guard++) {
    idx = (idx + direction + n) % n;
    const candidate = order[idx]!;

    if (!isEligible(candidate)) continue;

    const skips = pendingSkips[candidate] ?? 0;
    if (skips > 0) {
      pendingSkips[candidate] = skips - 1;
      skipped.push(candidate);
      continue;
    }

    return { currentId: candidate, pendingSkips, skipped };
  }

  // Nobody eligible — keep current player (caller decides what to do).
  return { currentId: turn.currentId, pendingSkips, skipped };
}

/** Queue a skip against a participant (e.g. when a Freeze card is discarded). */
export function queueSkip(
  pendingSkips: Record<string, number>,
  targetId: string,
  count = 1,
): Record<string, number> {
  return { ...pendingSkips, [targetId]: (pendingSkips[targetId] ?? 0) + count };
}

/** Rotate the "first player" of a round by `n` seats (used between rounds). */
export function rotateStart(order: string[], roundIndex: number): string {
  if (order.length === 0) throw new Error("Cannot rotate an empty turn order");
  return order[roundIndex % order.length]!;
}
