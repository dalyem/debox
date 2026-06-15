import type { TileState } from "./types";

/**
 * Wordle feedback — the pure colouring rules.
 *
 * The only subtlety is duplicate letters: a letter is marked "present" (yellow)
 * at most as many times as it actually appears in the answer, after exact
 * "correct" (green) matches have claimed their slots. We do a two-pass count so
 * e.g. guessing ALLEY against LEVEL greens the right L and greys the extra one.
 */
export function evaluateGuess(guess: string, answer: string): TileState[] {
  const g = guess.toUpperCase();
  const a = answer.toUpperCase();
  const n = g.length;
  const result: TileState[] = new Array(n).fill("absent");

  // Tally answer letters not already claimed by a green match.
  const remaining: Record<string, number> = {};
  for (const ch of a) remaining[ch] = (remaining[ch] ?? 0) + 1;

  // Pass 1: exact position matches (green).
  for (let i = 0; i < n; i++) {
    if (g[i] === a[i]) {
      result[i] = "correct";
      remaining[g[i]!] = (remaining[g[i]!] ?? 0) - 1;
    }
  }

  // Pass 2: right letter, wrong spot (yellow), bounded by what's left.
  for (let i = 0; i < n; i++) {
    if (result[i] === "correct") continue;
    const ch = g[i]!;
    if ((remaining[ch] ?? 0) > 0) {
      result[i] = "present";
      remaining[ch] = remaining[ch]! - 1;
    }
  }

  return result;
}

export function isAllCorrect(pattern: TileState[]): boolean {
  return pattern.length > 0 && pattern.every((t) => t === "correct");
}

const RANK: Record<TileState, number> = { absent: 0, present: 1, correct: 2 };

/**
 * Fold a guess into the running keyboard hint map, keeping the *best* status
 * seen for each letter (correct beats present beats absent) so a letter never
 * downgrades from green to yellow on a later guess.
 */
export function mergeKeyboard(
  keyboard: Record<string, TileState>,
  guess: string,
  pattern: TileState[],
): Record<string, TileState> {
  const out = { ...keyboard };
  const g = guess.toUpperCase();
  for (let i = 0; i < g.length; i++) {
    const ch = g[i]!;
    const next = pattern[i]!;
    const cur = out[ch];
    if (!cur || RANK[next] > RANK[cur]) out[ch] = next;
  }
  return out;
}
