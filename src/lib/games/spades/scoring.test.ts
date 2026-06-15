import { describe, it, expect } from "vitest";
import { decideWinner, scoreTeamRound, type PlayerRoundInput } from "@/lib/games/spades/scoring";

const cfg = { bagPenalty: 100, nilValue: 100 };
const p = (bid: number, tricks: number, isNil = false): PlayerRoundInput => ({
  playerId: `p${bid}-${tricks}`,
  team: 0,
  bid,
  isNil,
  tricks,
});

describe("scoreTeamRound — contracts", () => {
  it("awards 10 per bid trick when the contract is made exactly", () => {
    const r = scoreTeamRound([p(3, 2), p(2, 3)], 0, cfg); // bid 5, took 5
    expect(r.combinedBid).toBe(5);
    expect(r.combinedTricks).toBe(5);
    expect(r.madeContract).toBe(true);
    expect(r.contractDelta).toBe(50);
    expect(r.bagsThisRound).toBe(0);
    expect(r.roundDelta).toBe(50);
  });

  it("adds 1 point per overtrick (bag)", () => {
    const r = scoreTeamRound([p(2, 4), p(2, 2)], 0, cfg); // bid 4, took 6 → 2 bags
    expect(r.contractDelta).toBe(42); // 40 + 2 bags
    expect(r.bagsThisRound).toBe(2);
    expect(r.newBags).toBe(2);
    expect(r.roundDelta).toBe(42);
  });

  it("sets a team that misses its bid (−10 per bid trick)", () => {
    const r = scoreTeamRound([p(4, 1), p(3, 2)], 0, cfg); // bid 7, took 3
    expect(r.madeContract).toBe(false);
    expect(r.contractDelta).toBe(-70);
    expect(r.bagsThisRound).toBe(0);
    expect(r.roundDelta).toBe(-70);
  });
});

describe("scoreTeamRound — bag penalty", () => {
  it("subtracts 100 when the team crosses a multiple of 10 bags", () => {
    const r = scoreTeamRound([p(1, 5), p(1, 4)], 8, cfg); // bid 2, took 9 → 7 bags
    expect(r.bagsThisRound).toBe(7);
    expect(r.newBags).toBe(15); // 8 + 7, crossed 10 once
    expect(r.bagPenalty).toBe(-100);
    // contract: 20 + 7 bags = 27, minus 100 penalty
    expect(r.contractDelta).toBe(27);
    expect(r.roundDelta).toBe(-73);
  });

  it("does not penalize when no multiple of 10 is crossed", () => {
    const r = scoreTeamRound([p(2, 3), p(2, 2)], 2, cfg); // 1 bag, 2→3
    expect(r.bagPenalty).toBe(0);
  });
});

describe("scoreTeamRound — nil", () => {
  it("rewards a made nil and still scores the partner's contract", () => {
    const r = scoreTeamRound([p(0, 0, true), p(3, 3)], 0, cfg);
    expect(r.combinedBid).toBe(3);
    expect(r.contractDelta).toBe(30);
    expect(r.nilDelta).toBe(100);
    expect(r.nil).toEqual([{ playerId: "p0-0", made: true }]);
    expect(r.roundDelta).toBe(130);
  });

  it("penalizes a busted nil and counts its tricks toward the team", () => {
    const r = scoreTeamRound([p(0, 2, true), p(3, 3)], 0, cfg); // nil took 2
    expect(r.combinedBid).toBe(3);
    expect(r.combinedTricks).toBe(5); // 2 + 3
    expect(r.bagsThisRound).toBe(2); // overtricks become bags
    expect(r.contractDelta).toBe(32);
    expect(r.nilDelta).toBe(-100);
    expect(r.roundDelta).toBe(-68);
  });
});

describe("decideWinner", () => {
  it("returns null until a team reaches the target", () => {
    expect(decideWinner([480, 300], 500)).toBeNull();
  });
  it("returns the higher team once the target is reached", () => {
    expect(decideWinner([510, 300], 500)).toBe(0);
    expect(decideWinner([300, 520], 500)).toBe(1);
  });
  it("returns null on a tie at or above the target", () => {
    expect(decideWinner([520, 520], 500)).toBeNull();
  });
});
