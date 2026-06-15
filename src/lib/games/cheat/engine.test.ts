import { describe, it, expect } from "vitest";
import { cardId, type Rank, type StandardCard, type Suit } from "@/lib/cards/standard";
import type { SeatedPlayer } from "@/lib/platform/types";
import { CheatEngine as engine, _internal } from "@/lib/games/cheat/engine";
import type { CheatPlayerState, CheatState, PrivateCheatView } from "@/lib/games/cheat/types";

const C = (suit: Suit, rank: Rank): StandardCard => ({ id: cardId(suit, rank), suit, rank });

const seated = (id: string, seat: number): SeatedPlayer => ({
  playerId: id,
  displayName: id,
  seat,
  avatar: { color: "bubblegum", emoji: "🤥" },
  isActive: true,
});

const THREE = [seated("A", 0), seated("B", 1), seated("C", 2)];
const ctx = (now = 1000, seed = 3) => ({ players: THREE, seed, now });

function mkPlayer(id: string, seat: number, hand: StandardCard[]): CheatPlayerState {
  return { playerId: id, seat, hand };
}

function mkState(over: Partial<CheatState> = {}): CheatState {
  const seatOrder = ["A", "B", "C"];
  const base: CheatState = {
    v: 1,
    game: "cheat",
    seed: 1,
    config: { maxClaim: 4 },
    seatOrder,
    // Filler cards so non-acting players are never accidental "0-card winners".
    players: {
      A: mkPlayer("A", 0, [C("diamonds", 2)]),
      B: mkPlayer("B", 1, [C("diamonds", 3)]),
      C: mkPlayer("C", 2, [C("diamonds", 4)]),
    },
    currentPlayerId: "A",
    requiredRankIndex: 0,
    pile: [],
    lastPlay: null,
    lastChallenge: null,
    turn: { seq: 1, startedAt: 0, deadline: 9e12 },
    winnerId: null,
    status: "in_progress",
  };
  return { ...base, ...over };
}

describe("setup", () => {
  it("deals the whole deck as evenly as possible and starts on Aces", () => {
    const created = engine.createGame({ players: THREE, config: engine.defaultConfig(), seed: 1, now: 0 });
    const s = engine.startGame(created, ctx()).state;
    const counts = s.seatOrder.map((id) => s.players[id]!.hand.length);
    expect(counts).toEqual([18, 17, 17]);
    const all = s.seatOrder.flatMap((id) => s.players[id]!.hand.map((c) => c.id));
    expect(new Set(all).size).toBe(52);
    expect(s.currentPlayerId).toBe("A");
    expect(_internal.requiredRankAt(s.requiredRankIndex)).toBe(14); // Aces
  });

  it("advances the required rank A→2→…→K then loops", () => {
    const seq = Array.from({ length: 14 }, (_, i) => _internal.requiredRankAt(i));
    expect(seq).toEqual([14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });
});

describe("playing + rank/turn advance", () => {
  it("an honest play advances the required rank and passes the turn", () => {
    const s = mkState({ players: { ...mkState().players, A: mkPlayer("A", 0, [C("spades", 14), C("clubs", 7)]) } });
    const step = engine.submitMove(s, "A", { type: "play", cardIds: [cardId("spades", 14)] }, ctx());
    expect(step.status).toBe("in_progress");
    expect(step.state.currentPlayerId).toBe("B");
    expect(_internal.requiredRankAt(step.state.requiredRankIndex)).toBe(2);
    expect(step.state.lastPlay).toMatchObject({ playerId: "A", claimedRank: 14, count: 1 });
    expect(step.state.pile).toHaveLength(1);
  });

  it("enforces turn order, claim size, and card ownership", () => {
    const s = mkState({ players: { ...mkState().players, A: mkPlayer("A", 0, [C("spades", 14)]) } });
    expect(engine.validateMove(s, "B", { type: "play", cardIds: [cardId("spades", 14)] }).ok).toBe(false);
    expect(engine.validateMove(s, "A", { type: "play", cardIds: [] }).ok).toBe(false);
    expect(engine.validateMove(s, "A", { type: "play", cardIds: [cardId("hearts", 9)] }).ok).toBe(false);
  });
});

describe("challenges", () => {
  it("a caught bluff makes the liar eat the pile", () => {
    const s = mkState({
      players: {
        A: mkPlayer("A", 0, []), // played all into the pile
        B: mkPlayer("B", 1, [C("hearts", 2)]),
        C: mkPlayer("C", 2, [C("diamonds", 4)]),
      },
      pile: [C("clubs", 5), C("clubs", 6)],
      lastPlay: { playerId: "A", claimedRank: 14, count: 2, cards: [C("clubs", 5), C("clubs", 6)] },
      currentPlayerId: "B",
    });
    const step = engine.submitMove(s, "B", { type: "challenge" }, ctx());
    expect(step.state.lastChallenge).toMatchObject({ wasBluff: true, loserId: "A", pileSize: 2 });
    expect(step.state.players.A!.hand).toHaveLength(2); // A ate the pile
    expect(step.state.pile).toHaveLength(0);
    expect(step.state.currentPlayerId).toBe("A"); // loser leads next
  });

  it("a wrong challenge makes the challenger eat the pile", () => {
    const s = mkState({
      players: {
        A: mkPlayer("A", 0, [C("clubs", 2)]), // truthful claim, still holds a card
        B: mkPlayer("B", 1, [C("clubs", 3)]),
        C: mkPlayer("C", 2, []), // challenger — will eat the pile
      },
      pile: [C("spades", 14), C("hearts", 14)],
      lastPlay: { playerId: "A", claimedRank: 14, count: 2, cards: [C("spades", 14), C("hearts", 14)] },
      currentPlayerId: "B",
    });
    const step = engine.submitMove(s, "C", { type: "challenge" }, ctx()); // C (not current) challenges
    expect(step.state.lastChallenge).toMatchObject({ wasBluff: false, loserId: "C" });
    expect(step.state.players.C!.hand).toHaveLength(2);
    expect(step.state.currentPlayerId).toBe("C");
  });

  it("you cannot challenge your own play; nothing to challenge throws via validate", () => {
    const s = mkState({
      lastPlay: { playerId: "A", claimedRank: 14, count: 1, cards: [C("clubs", 5)] },
      pile: [C("clubs", 5)],
      currentPlayerId: "B",
    });
    expect(engine.validateMove(s, "A", { type: "challenge" }).ok).toBe(false);
    expect(engine.validateMove(s, "B", { type: "challenge" }).ok).toBe(true);
    const empty = mkState();
    expect(engine.validateMove(empty, "B", { type: "challenge" }).ok).toBe(false);
  });
});

describe("winning", () => {
  it("does not win while the final play can still be challenged", () => {
    const s = mkState({ players: { ...mkState().players, A: mkPlayer("A", 0, [C("spades", 14)]) } });
    const step = engine.submitMove(s, "A", { type: "play", cardIds: [cardId("spades", 14)] }, ctx());
    expect(step.state.players.A!.hand).toHaveLength(0);
    expect(step.status).toBe("in_progress");
    expect(step.state.winnerId).toBeNull();
  });

  it("wins once the next player plays (declining to challenge)", () => {
    const s = mkState({
      players: {
        A: mkPlayer("A", 0, [C("spades", 14)]),
        B: mkPlayer("B", 1, [C("clubs", 9)]),
        C: mkPlayer("C", 2, [C("diamonds", 4)]),
      },
    });
    let step = engine.submitMove(s, "A", { type: "play", cardIds: [cardId("spades", 14)] }, ctx());
    step = engine.submitMove(step.state, "B", { type: "play", cardIds: [cardId("clubs", 9)] }, ctx());
    expect(step.status).toBe("game_over");
    expect(step.state.winnerId).toBe("A");
  });

  it("wins when a challenge confirms the final play was honest", () => {
    const s = mkState({ players: { ...mkState().players, A: mkPlayer("A", 0, [C("spades", 14)]) } });
    let step = engine.submitMove(s, "A", { type: "play", cardIds: [cardId("spades", 14)] }, ctx());
    step = engine.submitMove(step.state, "C", { type: "challenge" }, ctx());
    expect(step.state.lastChallenge!.wasBluff).toBe(false);
    expect(step.status).toBe("game_over");
    expect(step.state.winnerId).toBe("A");
  });
});

describe("information hiding", () => {
  it("never exposes hidden pile / hand cards in the public view", () => {
    const s = mkState({
      players: {
        A: mkPlayer("A", 0, [C("diamonds", 8)]),
        B: mkPlayer("B", 1, [C("clubs", 3)]),
        C: mkPlayer("C", 2, [C("clubs", 4)]),
      },
      pile: [C("clubs", 5)],
      lastPlay: { playerId: "A", claimedRank: 14, count: 1, cards: [C("clubs", 5)] },
      currentPlayerId: "B",
    });
    const pub = JSON.stringify(engine.getPublicState(s, THREE));
    expect(pub).not.toContain(cardId("clubs", 5)); // hidden pile card
    expect(pub).not.toContain(cardId("diamonds", 8)); // someone's hand
    expect(pub).not.toMatch(/"hand"/);

    const priv = engine.getPrivateState(s, "A", THREE) as PrivateCheatView;
    expect(priv.you.hand.map((c) => c.id)).toEqual([cardId("diamonds", 8)]);
    // The pile contents are not revealed to the player either (only the claim).
    expect(JSON.stringify(priv.you)).not.toContain(cardId("clubs", 5));
    // The accused can't challenge their own play; a bystander can.
    expect(priv.actions.canChallenge).toBe(false);
    const privB = engine.getPrivateState(s, "B", THREE) as PrivateCheatView;
    expect(privB.actions.canChallenge).toBe(true);
  });
});

describe("autoResolveTurn", () => {
  it("auto-plays a card to end a stalled turn", () => {
    const s = mkState({ players: { ...mkState().players, A: mkPlayer("A", 0, [C("clubs", 3), C("hearts", 9)]) } });
    const step = engine.autoResolveTurn!(s, "A", ctx());
    expect(step.state.players.A!.hand).toHaveLength(1);
    expect(step.state.pile).toHaveLength(1);
    expect(step.state.currentPlayerId).toBe("B");
  });
});
