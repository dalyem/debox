import { describe, it, expect } from "vitest";
import type { SeatedPlayer } from "@/lib/platform/types";
import { WordRushEngine as engine, _internal } from "@/lib/games/word-rush/engine";
import type {
  PrivateWordRushView,
  PublicWordRushView,
  WordRushConfig,
  WordRushState,
} from "@/lib/games/word-rush/types";
import { ANSWERS } from "@/lib/games/word-rush/words";

const seated = (id: string, seat: number): SeatedPlayer => ({
  playerId: id,
  displayName: id,
  seat,
  avatar: { color: "lime", emoji: "🟩" },
  isActive: true,
});

const P2 = [seated("A", 0), seated("B", 1)];
const P3 = [seated("A", 0), seated("B", 1), seated("C", 2)];

function start(
  players: SeatedPlayer[] = P3,
  now = 1000,
  overrides: Partial<WordRushConfig> = {},
): WordRushState {
  const config = { ...engine.defaultConfig(), ...overrides };
  const created = engine.createGame({ players, config, seed: 123, now: 0 });
  return engine.startGame(created, { players, seed: 123, now }).state;
}

function guess(
  state: WordRushState,
  id: string,
  word: string,
  now: number,
  players: SeatedPlayer[] = P3,
) {
  return engine.submitMove(state, id, { type: "guess", word }, { players, seed: 1, now });
}

/** A valid dictionary word that is NOT the current answer. */
function wrongWord(state: WordRushState, exclude: string[] = []): string {
  const skip = new Set([state.answer, ...exclude]);
  return ANSWERS.map((w) => w.toUpperCase()).find((w) => !skip.has(w))!;
}

describe("setup", () => {
  it("deals round 1 with a hidden answer and everyone racing", () => {
    const s = start();
    expect(s.round).toBe(1);
    expect(s.phase).toBe("racing");
    expect(s.answer).toHaveLength(5);
    expect(ANSWERS).toContain(s.answer.toLowerCase());
    expect(_internal.stillPlaying(s)).toEqual(["A", "B", "C"]);
    expect(s.lockDeadline).toBeNull();
  });

  it("never leaks the answer in the public projection while racing", () => {
    const s = start();
    const pub = engine.getPublicState(s, P3) as PublicWordRushView;
    expect(pub.reveal).toBeNull();
    expect(JSON.stringify(pub)).not.toContain(s.answer);
  });

  it("rejects a wordLength that doesn't match the dictionary", () => {
    expect(() =>
      engine.createGame({
        players: P2,
        config: { ...engine.defaultConfig(), wordLength: 4 },
        seed: 1,
        now: 0,
      }),
    ).toThrow();
  });
});

describe("solving and scoring", () => {
  it("scores a one-guess solve at accuracy + 1st-place bonus", () => {
    const s = start();
    const step = guess(s, "A", s.answer, 1000);
    const a = step.state.players.A!;
    expect(a.status).toBe("solved");
    expect(a.placement).toBe(1);
    expect(a.roundScore).toBe(11); // 6 accuracy + 5 placement
    expect(a.totalScore).toBe(11);
  });

  it("starts the shared clock when the first of several players locks in", () => {
    const s = start();
    const step = guess(s, "A", s.answer, 5000);
    expect(step.status).toBe("in_progress");
    expect(step.state.lockDeadline).toBe(5000 + 150_000); // base 120s + 30s/extra player
    expect(step.state.lockSeq).toBe(1);

    const pub = engine.getPublicState(step.state, P3) as PublicWordRushView;
    expect(pub.countdownDeadline).toBe(5000 + 150_000);
    expect(pub.turnSeq).toBe(1);
    expect(pub.turnDeadline).toBe(5000 + 150_000);
    expect(pub.currentPlayerId).toBe("B"); // first still racing
    expect(step.events.some((e) => e.type === "wr_lock_start")).toBe(true);
  });

  it("ratchets the clock down on each subsequent lock-in (re-arming via lockSeq)", () => {
    let s = start();
    s = guess(s, "A", s.answer, 5000).state; // deadline = 155000, seq 1
    const step = guess(s, "B", s.answer, 6000); // shorten by 45s
    expect(step.state.lockDeadline).toBe(155_000 - 45_000);
    expect(step.state.lockSeq).toBe(2); // bumped so the platform re-arms the timer
    expect(step.events.some((e) => e.type === "wr_lock_shorten")).toBe(true);
  });

  it("ends the round once everyone has finished (2-player game)", () => {
    let s = start(P2, 1000);
    s = guess(s, "A", s.answer, 1000, P2).state;
    const step = guess(s, "B", s.answer, 1200, P2);
    expect(step.status).toBe("round_over");
    expect(step.state.phase).toBe("round_over");
    expect(step.state.lockDeadline).toBeNull();
    expect(step.state.lastSummary?.answer).toBe(s.answer);
  });
});

describe("failing and timing out", () => {
  it("docks points for burning all six guesses", () => {
    const s = start(P2, 1000);
    const wrongs = ANSWERS.map((w) => w.toUpperCase()).filter((w) => w !== s.answer).slice(0, 6);
    let step = guess(s, "A", wrongs[0]!, 1000, P2);
    for (let i = 1; i < 6; i++) step = guess(step.state, "A", wrongs[i]!, 1000 + i, P2);
    const a = step.state.players.A!;
    expect(a.status).toBe("failed");
    expect(a.roundScore).toBe(-3);
    expect(a.totalScore).toBe(-3);
  });

  it("times out stragglers for zero when the clock expires", () => {
    let s = start(P3, 1000);
    s = guess(s, "A", s.answer, 2000).state; // clock starts
    const step = engine.autoResolveTurn!(s, "B", { players: P3, seed: 1, now: 999_999 });
    expect(step.status).toBe("round_over");
    expect(step.state.players.B!.status).toBe("timed_out");
    expect(step.state.players.C!.status).toBe("timed_out");
    expect(step.state.players.B!.roundScore).toBe(0);
    expect(step.state.players.A!.status).toBe("solved");
  });

  it("rejects a guess at/after the lock deadline (hard cutoff)", () => {
    const s = start(P3, 1000);
    const afterA = guess(s, "A", s.answer, 2000).state; // clock starts
    const deadline = afterA.lockDeadline!;
    const step = engine.submitMove(
      afterA,
      "B",
      { type: "guess", word: wrongWord(afterA) },
      { players: P3, seed: 1, now: deadline + 1 },
    );
    expect(step.status).toBe("round_over");
    expect(step.state.players.B!.status).toBe("timed_out");
    expect(step.state.players.B!.guesses.length).toBe(0); // the late guess wasn't applied
  });
});

describe("validation", () => {
  it("rejects wrong length, non-words, and out-of-turn states", () => {
    const s = start(P2, 1000);
    expect(engine.validateMove(s, "A", { type: "guess", word: "cat" }).ok).toBe(false);
    expect(engine.validateMove(s, "A", { type: "guess", word: "zzzzz" }).ok).toBe(false);
    expect(engine.validateMove(s, "A", { type: "guess", word: wrongWord(s) }).ok).toBe(true);

    const solved = guess(s, "A", s.answer, 1000, P2).state;
    expect(engine.validateMove(solved, "A", { type: "guess", word: wrongWord(s) }).ok).toBe(false);
  });
});

describe("round progression and match end", () => {
  it("deals a fresh, non-repeating word on resume", () => {
    let s = start(P2, 1000);
    s = guess(s, "A", s.answer, 1000, P2).state;
    const firstAnswer = s.answer;
    const over = guess(s, "B", s.answer, 1100, P2).state;
    const next = engine.resume!(over, { players: P2, seed: 1, now: 2000 }).state;
    expect(next.round).toBe(2);
    expect(next.phase).toBe("racing");
    expect(next.answer).not.toBe(firstAnswer);
    expect(next.usedWords).toContain(firstAnswer.toLowerCase());
    expect(next.players.A!.guesses).toEqual([]);
    expect(next.players.A!.totalScore).toBe(over.players.A!.totalScore); // carries over
  });

  it("ends the match at the round cap", () => {
    let s = start(P2, 1000, { maxRounds: 2, targetScore: 999 });
    // round 1
    s = guess(s, "A", s.answer, 1000, P2).state;
    let step = guess(s, "B", s.answer, 1100, P2);
    expect(step.status).toBe("round_over");
    // round 2 (the cap)
    s = engine.resume!(step.state, { players: P2, seed: 1, now: 2000 }).state;
    s = guess(s, "A", s.answer, 2000, P2).state;
    step = guess(s, "B", s.answer, 2100, P2);
    expect(step.status).toBe("game_over");
    expect(step.state.phase).toBe("game_over");
  });

  it("ends the match early when a player reaches the target score", () => {
    let s = start(P2, 1000, { targetScore: 5, maxRounds: 5 });
    s = guess(s, "A", s.answer, 1000, P2).state; // A: 11 pts >= 5
    const step = guess(s, "B", s.answer, 1100, P2);
    expect(step.status).toBe("game_over");
  });
});

describe("results", () => {
  it("ranks by score, sharing ranks on ties and naming the leader(s)", () => {
    let s = start(P3, 1000);
    s = guess(s, "A", s.answer, 1000).state; // A solves 1st
    s = guess(s, "B", s.answer, 1100).state; // B solves 2nd
    const ended = _internal.endRound(s, [], 5000).state; // C times out
    const result = engine.endGame(ended);
    expect(result.standings[0]!.playerId).toBe("A");
    expect(result.winners).toContain("A");
    expect(result.standings[result.standings.length - 1]!.playerId).toBe("C");
    expect(result.standings.find((x) => x.playerId === "C")!.score).toBe(0);
  });
});

describe("private projection", () => {
  it("shows your own letters, keyboard hints, and hides others' words", () => {
    const s = start(P3, 1000);
    const opener = wrongWord(s);
    const after = guess(s, "A", opener, 1000).state;
    const view = engine.getPrivateState(after, "A", P3) as PrivateWordRushView;
    expect(view.you.rows[0]!.word).toBe(opener);
    expect(view.you.guessesLeft).toBe(5);
    expect(Object.keys(view.you.keyboard).length).toBeGreaterThan(0);
    expect(view.canGuess).toBe(true);
    // B hasn't guessed; their private view exposes no letters of A's guess.
    const bView = engine.getPrivateState(after, "B", P3) as PrivateWordRushView;
    expect(bView.you.rows).toEqual([]);
  });
});
