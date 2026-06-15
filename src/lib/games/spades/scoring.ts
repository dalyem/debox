import type { NilOutcome, SpadesConfig, TeamId } from "./types";

/**
 * Spades scoring — pure, side-effect-free, unit-tested.
 *
 * Rules implemented (a common, internally-consistent casual ruleset):
 *  • A team's contract is the sum of its two partners' bids (a nil bid counts
 *    as 0 toward the contract).
 *  • Made contract: +10 per bid trick, +1 per overtrick ("bag").
 *  • Set (fewer tricks than bid): −10 per bid trick.
 *  • Bags accumulate; every 10th bag costs `bagPenalty` (default 100).
 *  • Nil: a player who bid 0 scores ±`nilValue` for taking zero / any tricks.
 *    Their tricks still count toward the team total (so a busted nil's tricks
 *    can become bags) — a deliberate MVP simplification, see ARCHITECTURE.md.
 */

export interface PlayerRoundInput {
  playerId: string;
  team: TeamId;
  bid: number;
  /** True when this bid is a nil (0 with nil enabled). */
  isNil: boolean;
  tricks: number;
}

export interface TeamScore {
  combinedBid: number;
  combinedTricks: number;
  madeContract: boolean;
  contractDelta: number;
  bagsThisRound: number;
  bagPenalty: number;
  nilDelta: number;
  nil: NilOutcome[];
  roundDelta: number;
  newBags: number;
}

/** Score a single team's round given its two players' results + prior bags. */
export function scoreTeamRound(
  players: PlayerRoundInput[],
  priorBags: number,
  config: Pick<SpadesConfig, "bagPenalty" | "nilValue">,
): TeamScore {
  // Contract excludes nil bids (they contribute 0).
  const combinedBid = players.reduce((s, p) => s + (p.isNil ? 0 : p.bid), 0);
  const combinedTricks = players.reduce((s, p) => s + p.tricks, 0);

  let contractDelta = 0;
  let bagsThisRound = 0;
  const madeContract = combinedTricks >= combinedBid;
  if (combinedBid === 0) {
    // No contracted tricks (e.g. both nil): every trick taken is a bag.
    bagsThisRound = combinedTricks;
  } else if (madeContract) {
    contractDelta = combinedBid * 10;
    bagsThisRound = combinedTricks - combinedBid;
    contractDelta += bagsThisRound; // +1 point per bag
  } else {
    contractDelta = -combinedBid * 10;
  }

  // Bag penalty for each multiple of 10 crossed by the new cumulative total.
  const newBags = priorBags + bagsThisRound;
  const penalties = Math.floor(newBags / 10) - Math.floor(priorBags / 10);
  const bagPenalty = penalties > 0 ? -penalties * config.bagPenalty : 0;

  // Nil bonuses/penalties.
  const nil: NilOutcome[] = [];
  let nilDelta = 0;
  for (const p of players) {
    if (!p.isNil) continue;
    const made = p.tricks === 0;
    nil.push({ playerId: p.playerId, made });
    nilDelta += made ? config.nilValue : -config.nilValue;
  }

  const roundDelta = contractDelta + bagPenalty + nilDelta;

  return {
    combinedBid,
    combinedTricks,
    madeContract,
    contractDelta,
    bagsThisRound,
    bagPenalty,
    nilDelta,
    nil,
    roundDelta,
    newBags,
  };
}

/**
 * Decide the winning team once a round is scored. Returns the winning `TeamId`,
 * or `null` if nobody has reached the target yet (or it's a tie at/above it).
 */
export function decideWinner(
  scores: [number, number],
  targetScore: number,
): TeamId | null {
  const [a, b] = scores;
  const reached = a >= targetScore || b >= targetScore;
  if (!reached) return null;
  if (a === b) return null; // tie at/above target → play another round
  return a > b ? 0 : 1;
}
