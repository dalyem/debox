import type { Card } from "../../cards/types";
import { type GroupType, validateGroup } from "../../cards/validate";

/**
 * Phase Cards — "The Climb".
 *
 * An original game inspired by the genre of phase-based rummy. Players race up a
 * ladder of ten increasingly tricky objectives ("Phases"). It uses no
 * trademarked names, art, or copy. Each objective is a list of card-group
 * requirements the player must lay down to advance.
 */

export interface PhaseRequirement {
  type: GroupType; // "set" | "run" | "color"
  count: number;
  /** UI label for the slot, e.g. "Set of 3". */
  label: string;
}

export interface PhaseDefinition {
  /** 1-based index up the ladder. */
  index: number;
  name: string;
  blurb: string;
  requirements: PhaseRequirement[];
}

const set = (count: number): PhaseRequirement => ({
  type: "set",
  count,
  label: `Set of ${count}`,
});
const run = (count: number): PhaseRequirement => ({
  type: "run",
  count,
  label: `Run of ${count}`,
});
const color = (count: number): PhaseRequirement => ({
  type: "color",
  count,
  label: `${count} of one color`,
});

/**
 * The ten phases. Mechanically equivalent to the classic phase ladder, with
 * original names + flavor:
 *   1: two sets of 3
 *   2: a set of 3 + a run of 4
 *   3: a set of 4 + a run of 4
 *   4: a run of 7
 *   5: a run of 8
 *   6: a run of 9
 *   7: two sets of 4
 *   8: seven cards of one color
 *   9: a set of 5 + a set of 2
 *  10: a set of 5 + a set of 3
 */
export const PHASES: PhaseDefinition[] = [
  { index: 1, name: "Double Trouble", blurb: "Two little sets to warm up.", requirements: [set(3), set(3)] },
  { index: 2, name: "Set & Stride", blurb: "A set, then start running.", requirements: [set(3), run(4)] },
  { index: 3, name: "Quad & Climb", blurb: "Bigger set, longer stride.", requirements: [set(4), run(4)] },
  { index: 4, name: "Lucky Seven", blurb: "One long, clean run.", requirements: [run(7)] },
  { index: 5, name: "Eighth Wonder", blurb: "Stretch it out further.", requirements: [run(8)] },
  { index: 6, name: "Cloud Nine", blurb: "The longest run yet.", requirements: [run(9)] },
  { index: 7, name: "Four by Four", blurb: "Two beefy sets.", requirements: [set(4), set(4)] },
  { index: 8, name: "True Colors", blurb: "Seven of a single color.", requirements: [color(7)] },
  { index: 9, name: "High Five & Two", blurb: "A big set and a pair.", requirements: [set(5), set(2)] },
  { index: 10, name: "Grand Finale", blurb: "The summit. Go big or go home.", requirements: [set(5), set(3)] },
];

export const TOTAL_PHASES = PHASES.length;
export const FIRST_PHASE = 1;
export const HAND_SIZE = 10;

export function getPhase(index: number): PhaseDefinition {
  const phase = PHASES[index - 1];
  if (!phase) throw new Error(`No phase at index ${index}`);
  return phase;
}

export function hasCompletedLadder(phaseIndex: number): boolean {
  return phaseIndex > TOTAL_PHASES;
}

export interface PhaseSlotResult {
  ok: boolean;
  reason?: string;
}

export interface PhaseValidation {
  ok: boolean;
  reason?: string;
  slots: PhaseSlotResult[];
}

/**
 * Validate a candidate phase lay-down. `groups[i]` must satisfy
 * `phase.requirements[i]`. Also enforces that no card id is used twice across
 * groups (cards are physically distinct).
 */
export function validatePhase(
  phase: PhaseDefinition,
  groups: Card[][],
): PhaseValidation {
  const slots: PhaseSlotResult[] = [];

  if (groups.length !== phase.requirements.length) {
    return {
      ok: false,
      reason: `Phase ${phase.index} needs ${phase.requirements.length} group(s)`,
      slots,
    };
  }

  // Cards must be distinct across all groups.
  const seen = new Set<string>();
  for (const group of groups) {
    for (const card of group) {
      if (seen.has(card.id)) {
        return {
          ok: false,
          reason: "A card can't be used in two groups at once",
          slots,
        };
      }
      seen.add(card.id);
    }
  }

  let allOk = true;
  for (let i = 0; i < phase.requirements.length; i++) {
    const req = phase.requirements[i]!;
    const res = validateGroup(req.type, groups[i]!, req.count);
    slots.push(res);
    if (!res.ok) allOk = false;
  }

  return {
    ok: allOk,
    reason: allOk ? undefined : "One or more groups don't satisfy the phase",
    slots,
  };
}
