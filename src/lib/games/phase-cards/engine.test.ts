import { describe, it, expect } from "vitest";
import type { Card, CardColor } from "@/lib/cards";
import type { SeatedPlayer } from "@/lib/platform/types";
import { PhaseCardsEngine as engine } from "@/lib/games/phase-cards/engine";
import type {
  PhaseCardsPlayer,
  PhaseCardsState,
  PrivateGameView,
  PublicGameView,
} from "@/lib/games/phase-cards/types";

const num = (color: CardColor, value: number, copy = 0): Card => ({
  id: `${color}-${value}-${copy}`,
  kind: "number",
  color,
  value,
});
const wild = (i = 0): Card => ({ id: `wild-${i}`, kind: "wild", color: null, value: null });
const freeze = (i = 0): Card => ({ id: `freeze-${i}`, kind: "freeze", color: null, value: null });

const seated = (id: string, seat: number): SeatedPlayer => ({
  playerId: id,
  displayName: id,
  seat,
  avatar: { color: "red", emoji: "🙂" },
  isActive: true,
});

const P = (s: PhaseCardsState, id: string): PhaseCardsPlayer => s.players[id]!;

function player(id: string, hand: Card[], phaseIndex = 1): PhaseCardsPlayer {
  return {
    playerId: id,
    hand,
    phaseIndex,
    completedPhase: false,
    laidGroups: [],
    score: 0,
    finishedLadder: false,
  };
}

function makeState(
  players: Record<string, PhaseCardsPlayer>,
  seatOrder: string[],
  currentId: string,
  opts: Partial<PhaseCardsState> = {},
): PhaseCardsState {
  return {
    v: 1,
    game: "phase-cards",
    seed: 1,
    round: 1,
    status: "in_progress",
    turn: {
      currentPlayerId: currentId,
      direction: 1,
      pendingSkips: {},
      hasDrawn: true,
      drewFrom: "draw",
      ...(opts.turn ?? {}),
    },
    drawPile: [num("blue", 6), num("green", 6, 1), num("yellow", 8)],
    discardPile: [num("yellow", 1)],
    seatOrder,
    players,
    lastRoundSummary: null,
    winnerIds: [],
    startedAt: 0,
    ...opts,
  };
}

const two = [seated("A", 0), seated("B", 1)];
const ctx2 = { players: two, seed: 12345, now: 1000 };

describe("setup", () => {
  it("deals ten cards each and seeds the piles", () => {
    const created = engine.createGame({
      players: two,
      config: engine.defaultConfig(),
      seed: 7,
      now: 0,
    });
    const { state } = engine.startGame(created, ctx2);
    expect(state.round).toBe(1);
    expect(state.seatOrder).toHaveLength(2);
    expect(P(state, "A").hand).toHaveLength(10);
    expect(P(state, "B").hand).toHaveLength(10);
    expect(state.drawPile).toHaveLength(108 - 20 - 1);
    expect(state.discardPile).toHaveLength(1);
    expect(["A", "B"]).toContain(state.turn.currentPlayerId);
  });
});

describe("information hiding", () => {
  it("never leaks opponents' hands through projections", () => {
    const created = engine.createGame({
      players: two,
      config: engine.defaultConfig(),
      seed: 7,
      now: 0,
    });
    const { state } = engine.startGame(created, ctx2);
    const me = state.turn.currentPlayerId;
    const them = me === "A" ? "B" : "A";

    const priv = engine.getPrivateState(state, me, two) as PrivateGameView;
    expect(priv.you.hand).toHaveLength(10);
    const opp = priv.table.find((t) => t.playerId === them)!;
    expect(opp.handCount).toBe(10);
    expect((opp as unknown as Record<string, unknown>).hand).toBeUndefined();

    const pub = engine.getPublicState(state, two) as PublicGameView;
    expect(
      pub.players.every(
        (p) => (p as unknown as Record<string, unknown>).hand === undefined,
      ),
    ).toBe(true);
    expect(pub.players.every((p) => p.handCount === 10)).toBe(true);
  });
});

describe("turn flow", () => {
  it("requires a draw before discarding, then passes the turn", () => {
    const s0 = makeState(
      { A: player("A", [num("red", 2), num("blue", 9), num("green", 11)]), B: player("B", [num("red", 5)]) },
      ["A", "B"],
      "A",
      { turn: { currentPlayerId: "A", direction: 1, pendingSkips: {}, hasDrawn: false, drewFrom: null } },
    );
    // Can't discard before drawing.
    expect(engine.validateMove(s0, "A", { type: "discard", cardId: "red-2-0" }).ok).toBe(false);
    // Opponent can't act out of turn.
    expect(engine.validateMove(s0, "B", { type: "draw", source: "draw" }).ok).toBe(false);

    const afterDraw = engine.submitMove(s0, "A", { type: "draw", source: "draw" }, ctx2).state;
    expect(afterDraw.turn.hasDrawn).toBe(true);
    expect(P(afterDraw, "A").hand).toHaveLength(4);

    const afterDiscard = engine.submitMove(
      afterDraw,
      "A",
      { type: "discard", cardId: "red-2-0" },
      ctx2,
    ).state;
    expect(afterDiscard.turn.currentPlayerId).toBe("B");
    expect(afterDiscard.turn.hasDrawn).toBe(false);
    expect(P(afterDiscard, "A").hand).toHaveLength(3);
  });
});

describe("laying down + going out + scoring", () => {
  it("scores the round, advances the finisher, penalizes the rest", () => {
    const handA = [
      num("red", 3),
      num("blue", 3),
      num("green", 3),
      num("red", 5),
      num("blue", 5),
      num("green", 5),
      num("yellow", 7),
    ];
    const handB = [num("red", 10), wild()];
    const s0 = makeState(
      { A: player("A", handA), B: player("B", handB) },
      ["A", "B"],
      "A",
    );

    const laid = engine.submitMove(
      s0,
      "A",
      {
        type: "layDown",
        groups: [
          ["red-3-0", "blue-3-0", "green-3-0"],
          ["red-5-0", "blue-5-0", "green-5-0"],
        ],
      },
      ctx2,
    ).state;
    expect(P(laid, "A").completedPhase).toBe(true);
    expect(P(laid, "A").laidGroups).toHaveLength(2);
    expect(P(laid, "A").hand).toHaveLength(1);

    const result = engine.submitMove(
      laid,
      "A",
      { type: "discard", cardId: "yellow-7-0" },
      ctx2,
    );
    expect(result.status).toBe("round_over");
    const fs = result.state;
    expect(fs.lastRoundSummary?.wentOutPlayerId).toBe("A");
    // A went out (0 penalty) and advances to phase 2.
    expect(P(fs, "A").phaseIndex).toBe(2);
    expect(P(fs, "A").score).toBe(0);
    // B keeps phase 1 and eats 10 + 25 = 35 points.
    expect(P(fs, "B").phaseIndex).toBe(1);
    expect(P(fs, "B").score).toBe(35);
    expect(result.events.some((e) => e.type === "round_end")).toBe(true);
  });

  it("resume() deals the next round, retaining phase progress", () => {
    const fs = makeState(
      { A: player("A", [], 2), B: player("B", [num("red", 10)]) },
      ["A", "B"],
      "A",
      { status: "round_over", round: 1 },
    );
    const resumed = engine.resume!(fs, { players: two, seed: 999, now: 2000 });
    expect(resumed.status).toBe("in_progress");
    expect(resumed.state.round).toBe(2);
    expect(P(resumed.state, "A").hand).toHaveLength(10);
    expect(P(resumed.state, "A").completedPhase).toBe(false);
    expect(P(resumed.state, "A").phaseIndex).toBe(2);
  });
});

describe("freeze / skip", () => {
  const three = [seated("A", 0), seated("B", 1), seated("C", 2)];
  const ctx3 = { players: three, seed: 1, now: 0 };

  it("skips the targeted player on their next turn", () => {
    const s0 = makeState(
      {
        A: player("A", [freeze(), num("red", 5)]),
        B: player("B", [num("blue", 4), num("green", 7)]),
        C: player("C", [num("yellow", 2)]),
      },
      ["A", "B", "C"],
      "A",
    );
    // A freezes C.
    const r1 = engine.submitMove(
      s0,
      "A",
      { type: "discard", cardId: "freeze-0", skipTargetPlayerId: "C" },
      ctx3,
    );
    expect(r1.state.turn.currentPlayerId).toBe("B");
    expect(r1.state.turn.pendingSkips["C"]).toBe(1);

    // B takes a normal turn; C should be skipped, landing back on A.
    const bDrew = engine.submitMove(r1.state, "B", { type: "draw", source: "draw" }, ctx3).state;
    const bDiscard = P(bDrew, "B").hand.find((c) => c.kind !== "freeze")!.id;
    const r2 = engine.submitMove(bDrew, "B", { type: "discard", cardId: bDiscard }, ctx3);
    expect(r2.state.turn.currentPlayerId).toBe("A");
    expect(r2.events.some((e) => e.type === "turn_skipped")).toBe(true);
  });

  it("requires a valid freeze target", () => {
    const s0 = makeState(
      { A: player("A", [freeze(), num("red", 5)]), B: player("B", [num("red", 1)]) },
      ["A", "B"],
      "A",
    );
    expect(engine.validateMove(s0, "A", { type: "discard", cardId: "freeze-0" }).ok).toBe(false);
    expect(
      engine.validateMove(s0, "A", {
        type: "discard",
        cardId: "freeze-0",
        skipTargetPlayerId: "A",
      }).ok,
    ).toBe(false);
  });
});

describe("endGame standings", () => {
  it("ranks finishers first, then by phase, then by score", () => {
    const s = makeState(
      {
        A: { ...player("A", []), phaseIndex: 11, finishedLadder: true, score: 120 },
        B: { ...player("B", []), phaseIndex: 6, score: 80 },
        C: { ...player("C", []), phaseIndex: 6, score: 40 },
      },
      ["A", "B", "C"],
      "A",
      { status: "game_over", winnerIds: ["A"] },
    );
    const result = engine.endGame(s);
    expect(result.winners).toEqual(["A"]);
    expect(result.standings.map((x) => x.playerId)).toEqual(["A", "C", "B"]);
    expect(result.standings[0]!.rank).toBe(1);
  });
});
