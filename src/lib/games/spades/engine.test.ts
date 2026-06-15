import { describe, it, expect } from "vitest";
import { cardId, type Rank, type StandardCard, type Suit } from "@/lib/cards/standard";
import type { SeatedPlayer } from "@/lib/platform/types";
import { SpadesEngine as engine, _internal } from "@/lib/games/spades/engine";
import type {
  PrivateSpadesView,
  PublicSpadesView,
  SpadesPlayerState,
  SpadesState,
  TeamId,
} from "@/lib/games/spades/types";

const C = (suit: Suit, rank: Rank): StandardCard => ({ id: cardId(suit, rank), suit, rank });

const seated = (id: string, seat: number): SeatedPlayer => ({
  playerId: id,
  displayName: id,
  seat,
  avatar: { color: "lagoon", emoji: "🂡" },
  isActive: true,
});

const FOUR = [seated("A", 0), seated("B", 1), seated("C", 2), seated("D", 3)];
const ctx = (now = 1000, seed = 7) => ({ players: FOUR, seed, now });

function mkPlayer(
  id: string,
  seat: number,
  hand: StandardCard[],
  bid: number | null = null,
  tricksWon = 0,
): SpadesPlayerState {
  return { playerId: id, seat, team: (seat % 2) as TeamId, hand, bid, tricksWon };
}

function mkState(over: Partial<SpadesState> = {}): SpadesState {
  const seatOrder = ["A", "B", "C", "D"];
  const base: SpadesState = {
    v: 1,
    game: "spades",
    seed: 1,
    round: 1,
    phase: "playing",
    config: { targetScore: 500, allowNil: true, nilValue: 100, bagPenalty: 100 },
    firstSeat: 0,
    seatOrder,
    players: {
      A: mkPlayer("A", 0, []),
      B: mkPlayer("B", 1, []),
      C: mkPlayer("C", 2, []),
      D: mkPlayer("D", 3, []),
    },
    teams: [
      { team: 0, score: 0, bags: 0 },
      { team: 1, score: 0, bags: 0 },
    ],
    trick: { leaderId: "A", ledSuit: null, plays: [] },
    completedTricks: 0,
    spadesBroken: false,
    turn: { currentPlayerId: "A", seq: 1, startedAt: 0, deadline: 9e12 },
    lastTrickWinnerId: null,
    lastRoundSummary: null,
    winnerTeam: null,
  };
  return { ...base, ...over };
}

describe("setup + bidding", () => {
  it("deals 13 to each player, fixed teams, bidding phase", () => {
    let s = engine.createGame({ players: FOUR, config: engine.defaultConfig(), seed: 1, now: 0 });
    expect(s.players.A!.team).toBe(0);
    expect(s.players.B!.team).toBe(1);
    expect(s.players.C!.team).toBe(0);
    expect(s.players.D!.team).toBe(1);

    const started = engine.startGame(s, ctx());
    s = started.state;
    expect(s.phase).toBe("bidding");
    for (const id of ["A", "B", "C", "D"]) expect(s.players[id]!.hand).toHaveLength(13);
    // Whole deck dealt, no duplicates.
    const all = Object.values(s.players).flatMap((p) => p.hand.map((c) => c.id));
    expect(new Set(all).size).toBe(52);
    expect(s.turn.currentPlayerId).toBe("A");
  });

  it("collects four bids then opens play with seat 0 leading", () => {
    let s = engine.startGame(
      engine.createGame({ players: FOUR, config: engine.defaultConfig(), seed: 2, now: 0 }),
      ctx(),
    ).state;
    for (const id of ["A", "B", "C", "D"]) {
      expect(s.phase).toBe("bidding");
      s = engine.submitMove(s, id, { type: "bid", bid: 3 }, ctx()).state;
    }
    expect(s.phase).toBe("playing");
    expect(s.turn.currentPlayerId).toBe("A");
    expect(s.players.A!.bid).toBe(3);
  });

  it("rejects an out-of-turn bid and a too-high bid", () => {
    const s = engine.startGame(
      engine.createGame({ players: FOUR, config: engine.defaultConfig(), seed: 2, now: 0 }),
      ctx(),
    ).state;
    expect(engine.validateMove(s, "B", { type: "bid", bid: 3 }).ok).toBe(false);
    expect(engine.validateMove(s, "A", { type: "bid", bid: 14 }).ok).toBe(false);
    expect(engine.validateMove(s, "A", { type: "bid", bid: 0 }).ok).toBe(true); // nil allowed
  });
});

describe("follow-suit + trump rules", () => {
  it("forces following the led suit when able", () => {
    const s = mkState({
      players: {
        A: mkPlayer("A", 0, [C("hearts", 13)]),
        B: mkPlayer("B", 1, [C("hearts", 2), C("clubs", 9)]),
        C: mkPlayer("C", 2, [C("clubs", 5)]),
        D: mkPlayer("D", 3, [C("clubs", 6)]),
      },
      trick: { leaderId: "A", ledSuit: "hearts", plays: [{ playerId: "A", card: C("hearts", 13) }] },
      turn: { currentPlayerId: "B", seq: 2, startedAt: 0, deadline: 9e12 },
      spadesBroken: true,
    });
    const legal = _internal.legalPlays(s, s.players.B!).map((c) => c.id);
    expect(legal).toEqual([cardId("hearts", 2)]);
    expect(engine.validateMove(s, "B", { type: "play", cardId: cardId("clubs", 9) }).ok).toBe(false);
    expect(engine.validateMove(s, "B", { type: "play", cardId: cardId("hearts", 2) }).ok).toBe(true);
  });

  it("blocks leading spades until broken, unless holding only spades", () => {
    const withMixed = mkState({
      players: { ...mkState().players, A: mkPlayer("A", 0, [C("hearts", 4), C("spades", 10)]) },
      trick: { leaderId: "A", ledSuit: null, plays: [] },
      spadesBroken: false,
    });
    expect(_internal.legalPlays(withMixed, withMixed.players.A!).map((c) => c.id)).toEqual([
      cardId("hearts", 4),
    ]);
    expect(engine.validateMove(withMixed, "A", { type: "play", cardId: cardId("spades", 10) }).ok).toBe(
      false,
    );

    const allSpades = mkState({
      players: { ...mkState().players, A: mkPlayer("A", 0, [C("spades", 4), C("spades", 10)]) },
      trick: { leaderId: "A", ledSuit: null, plays: [] },
      spadesBroken: false,
    });
    expect(_internal.legalPlays(allSpades, allSpades.players.A!)).toHaveLength(2);
  });
});

describe("trick resolution", () => {
  it("highest spade beats the led suit", () => {
    const winner = _internal.trickWinner({
      leaderId: "A",
      ledSuit: "hearts",
      plays: [
        { playerId: "A", card: C("hearts", 14) },
        { playerId: "B", card: C("hearts", 5) },
        { playerId: "C", card: C("spades", 2) },
        { playerId: "D", card: C("hearts", 13) },
      ],
    });
    expect(winner).toBe("C");
  });

  it("highest of led suit wins when no spades are played", () => {
    const winner = _internal.trickWinner({
      leaderId: "A",
      ledSuit: "clubs",
      plays: [
        { playerId: "A", card: C("clubs", 9) },
        { playerId: "B", card: C("clubs", 14) },
        { playerId: "C", card: C("diamonds", 13) },
        { playerId: "D", card: C("clubs", 3) },
      ],
    });
    expect(winner).toBe("B");
  });
});

describe("playing a full round → scoring", () => {
  it("awards the last trick and scores both teams", () => {
    // 12 tricks already played; one heart each remains.
    const s = mkState({
      completedTricks: 12,
      spadesBroken: true,
      players: {
        A: mkPlayer("A", 0, [C("hearts", 14)], 3, 3),
        B: mkPlayer("B", 1, [C("hearts", 5)], 4, 4),
        C: mkPlayer("C", 2, [C("hearts", 3)], 2, 2),
        D: mkPlayer("D", 3, [C("hearts", 4)], 3, 3),
      },
      turn: { currentPlayerId: "A", seq: 5, startedAt: 0, deadline: 9e12 },
      trick: { leaderId: "A", ledSuit: null, plays: [] },
    });
    let step = engine.submitMove(s, "A", { type: "play", cardId: cardId("hearts", 14) }, ctx());
    step = engine.submitMove(step.state, "B", { type: "play", cardId: cardId("hearts", 5) }, ctx());
    step = engine.submitMove(step.state, "C", { type: "play", cardId: cardId("hearts", 3) }, ctx());
    step = engine.submitMove(step.state, "D", { type: "play", cardId: cardId("hearts", 4) }, ctx());

    expect(step.status).toBe("round_over");
    expect(step.state.phase).toBe("round_over");
    const summary = step.state.lastRoundSummary!;
    const team0 = summary.teams.find((t) => t.team === 0)!;
    const team1 = summary.teams.find((t) => t.team === 1)!;
    // A wins the last trick → team0 took 4(A)+2(C)=6 on a bid of 5 → 50 +1 bag.
    expect(team0.tricks).toBe(6);
    expect(team0.bid).toBe(5);
    expect(team0.roundDelta).toBe(51);
    // team1 took 4(B)+3(D)=7 on a bid of 7 → 70 exactly.
    expect(team1.tricks).toBe(7);
    expect(team1.roundDelta).toBe(70);
    expect(step.state.teams[0].score).toBe(51);
    expect(step.state.teams[1].score).toBe(70);
  });

  it("ends the game when a team reaches the target score", () => {
    const s = mkState({
      completedTricks: 12,
      spadesBroken: true,
      teams: [
        { team: 0, score: 470, bags: 0 },
        { team: 1, score: 0, bags: 0 },
      ],
      players: {
        A: mkPlayer("A", 0, [C("hearts", 14)], 3, 3),
        B: mkPlayer("B", 1, [C("hearts", 5)], 4, 4),
        C: mkPlayer("C", 2, [C("hearts", 3)], 2, 2),
        D: mkPlayer("D", 3, [C("hearts", 4)], 3, 3),
      },
      turn: { currentPlayerId: "A", seq: 5, startedAt: 0, deadline: 9e12 },
      trick: { leaderId: "A", ledSuit: null, plays: [] },
    });
    let step = engine.submitMove(s, "A", { type: "play", cardId: cardId("hearts", 14) }, ctx());
    step = engine.submitMove(step.state, "B", { type: "play", cardId: cardId("hearts", 5) }, ctx());
    step = engine.submitMove(step.state, "C", { type: "play", cardId: cardId("hearts", 3) }, ctx());
    step = engine.submitMove(step.state, "D", { type: "play", cardId: cardId("hearts", 4) }, ctx());
    expect(step.status).toBe("game_over");
    expect(step.state.winnerTeam).toBe(0);
    const result = engine.endGame(step.state);
    expect(result.winners.sort()).toEqual(["A", "C"]);
  });
});

describe("information hiding", () => {
  it("public view exposes only hand counts; private view shows only your hand", () => {
    const started = engine.startGame(
      engine.createGame({ players: FOUR, config: engine.defaultConfig(), seed: 9, now: 0 }),
      ctx(),
    ).state;
    const pub = engine.getPublicState(started, FOUR) as PublicSpadesView;
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toMatch(/"hand"/);
    for (const p of pub.players) expect(p.handCount).toBe(13);

    const priv = engine.getPrivateState(started, "A", FOUR) as PrivateSpadesView;
    expect(priv.you.hand).toHaveLength(13);
    // No other player's hand is present anywhere in the private payload.
    const privSerialized = JSON.stringify(priv);
    const handOccurrences = privSerialized.match(/"hand"/g) ?? [];
    expect(handOccurrences).toHaveLength(1);
  });
});

describe("autoResolveTurn", () => {
  it("auto-bids during bidding and auto-plays a legal card during play", () => {
    let s = engine.startGame(
      engine.createGame({ players: FOUR, config: engine.defaultConfig(), seed: 5, now: 0 }),
      ctx(),
    ).state;
    const bidStep = engine.autoResolveTurn!(s, "A", ctx());
    expect(bidStep.state.players.A!.bid).not.toBeNull();
    expect(bidStep.state.turn.currentPlayerId).toBe("B");

    // Force into a play state where A leads.
    s = mkState({
      players: {
        A: mkPlayer("A", 0, [C("clubs", 9), C("spades", 2)]),
        B: mkPlayer("B", 1, [C("clubs", 5)]),
        C: mkPlayer("C", 2, [C("clubs", 6)]),
        D: mkPlayer("D", 3, [C("clubs", 7)]),
      },
      spadesBroken: false,
      trick: { leaderId: "A", ledSuit: null, plays: [] },
      turn: { currentPlayerId: "A", seq: 1, startedAt: 0, deadline: 9e12 },
    });
    const playStep = engine.autoResolveTurn!(s, "A", ctx());
    // Can't lead the spade (not broken) → must auto-play the club.
    expect(playStep.state.trick.plays[0]!.card.id).toBe(cardId("clubs", 9));
  });
});
