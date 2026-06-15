import type { WordRushConfig } from "./types";

/**
 * Word Rush — scoring.
 *
 * A solved word is worth accuracy + placement:
 *   • accuracy  — fewer guesses score more (solve in 1 → maxGuesses points,
 *                 solve on the last guess → 1 point),
 *   • placement — the race bonus, by finish order among solvers this round
 *                 (1st +5, 2nd +3, 3rd +2, everyone else +1).
 * Failing the word (all guesses used) costs `failPenalty` points; running out
 * of time with guesses left scores zero. Tuned so a strong-but-human player
 * lands around the mid-40s over five rounds — making the 50-point sprint finish
 * a genuine, occasionally-reachable target rather than a formality.
 */

/** Accuracy component: more points for solving in fewer guesses. */
export function accuracyPoints(guessesUsed: number, maxGuesses: number): number {
  return Math.max(1, maxGuesses + 1 - guessesUsed);
}

/** Race component: bonus for finishing earlier among the round's solvers. */
export function placementPoints(placement: number): number {
  switch (placement) {
    case 1:
      return 5;
    case 2:
      return 3;
    case 3:
      return 2;
    default:
      return 1;
  }
}

/** Total points for a solved word. */
export function solveScore(
  guessesUsed: number,
  placement: number,
  config: WordRushConfig,
): number {
  return accuracyPoints(guessesUsed, config.maxGuesses) + placementPoints(placement);
}

/**
 * The lock-in countdown granted when the first player finishes: a base window
 * plus extra time for each player beyond the second, so bigger rooms aren't
 * rushed. Each *subsequent* lock-in then shaves `lockStepMs` off the clock.
 */
export function lockWindowMs(playerCount: number, config: WordRushConfig): number {
  const extra = Math.max(0, playerCount - 2);
  return config.lockBaseMs + extra * config.lockPerExtraPlayerMs;
}
